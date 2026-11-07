"use strict";
const { serviceClient } = require("./clients");
const { firstName } = require("./validation");
const { shakeRevealState } = require("./shake-reveal");

const ERROR_MAP = {
  profile_missing: [404, "Create your profile first."],
  not_approved: [403, "Your profile must be approved by staff first."],
  inactive: [403, "Your account is not active."],
  profile_incomplete: [409, "Please complete your profile (gender, preferences, values) first."],
  staff_not_customer: [403, "Staff accounts do not use customer matching."],
  daily_match_limit_reached: [429, "You have used all five match recommendations for today. Come back tomorrow."],
  active_match_exists: [409, "You already have an active match."],
  payment_required: [402, "A paid match credit is required."],
  match_not_found: [404, "Match not found."],
  match_not_proposed: [409, "This match is no longer awaiting a response."],
  match_not_live: [409, "This match is already over."]
};

/** Translate a Postgres RPC error into an HTTP response. */
function rpcError(res, error) {
  const key = String(error?.message || "").trim();
  if (ERROR_MAP[key]) return res.status(ERROR_MAP[key][0]).json({ success: false, code: key, message: ERROR_MAP[key][1] });
  if (error?.code === "23505") return res.status(409).json({ success: false, code: "active_match_exists", message: "You already have an active match." });
  console.error("rpc error code:", error?.code || "unknown");
  return res.status(400).json({ success: false, message: "Request could not be completed." });
}

async function expire() { await serviceClient().rpc("nivora_expire_matches"); }

/** Return the match only if `userId` belongs to it. Same response for missing and foreign matches. */
async function getMatchFor(matchId, userId) {
  const { data } = await serviceClient().from("match_history").select("*").eq("id", matchId).maybeSingle();
  if (!data || ![data.user_one, data.user_two].includes(userId)) return null;
  return data;
}

/**
 * Chat/voice gate: caller must be a member, status 'active' and inside the 72h window.
 * Returns {match, partnerId} or {status, code, message}.
 */
async function assertLiveMatch(matchId, userId) {
  await expire();
  const match = await getMatchFor(matchId, userId);
  if (!match) return { status: 404, code: "match_not_found", message: "Match not found." };
  if (match.status !== "active" || (!["shake", "friend"].includes(match.match_source) && (!match.expires_at || new Date(match.expires_at) <= new Date()))) {
    return { status: 403, code: "match_not_live", message: "This conversation is closed or has been ended." };
  }
  const partnerId = match.user_one === userId ? match.user_two : match.user_one;
  const { data: accountStates, error: stateError } = await serviceClient().from("profiles")
    .select("id, is_active, suspended_at").in("id", [userId, partnerId]);
  if (stateError) return { status: 503, code: "safety_check_unavailable", message: "Conversation safety could not be verified." };
  if (!accountStates || accountStates.length !== 2 || accountStates.some((p) => !p.is_active || p.suspended_at)) {
    return { status: 403, code: "account_unavailable", message: "This conversation is unavailable." };
  }
  const { data: blocked } = await serviceClient().from("blocks").select("blocker_id")
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${partnerId}),and(blocker_id.eq.${partnerId},blocked_id.eq.${userId})`).limit(1);
  if (blocked && blocked.length) return { status: 403, code: "blocked", message: "This conversation is closed." };
  return { match, partnerId };
}

/** Chat is available during proposed and active states; voice remains active-only. */
async function assertChatMatch(matchId, userId) {
  await expire();
  const match = await getMatchFor(matchId, userId);
  if (!match) return { status: 404, code: "match_not_found", message: "Match not found." };
  if (!["proposed", "active"].includes(match.status) ||
      (!["shake", "friend"].includes(match.match_source) && (!match.expires_at || new Date(match.expires_at) <= new Date()))) {
    return { status: 403, code: "match_not_live", message: "This conversation is closed or has been ended." };
  }
  const partnerId = match.user_one === userId ? match.user_two : match.user_one;
  const { data: accountStates, error: stateError } = await serviceClient().from("profiles")
    .select("id, is_active, suspended_at").in("id", [userId, partnerId]);
  if (stateError) return { status: 503, code: "safety_check_unavailable", message: "Conversation safety could not be verified." };
  if (!accountStates || accountStates.length !== 2 || accountStates.some((p) => !p.is_active || p.suspended_at)) {
    return { status: 403, code: "account_unavailable", message: "This conversation is unavailable." }
  }
  const { data: blocked } = await serviceClient().from("blocks").select("blocker_id")
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${partnerId}),and(blocker_id.eq.${partnerId},blocked_id.eq.${userId})`).limit(1);
  if (blocked && blocked.length) return { status: 403, code: "blocked", message: "This conversation is closed." };
  return { match, partnerId };
}

/** Only fields a matched user may see. Never phone, email, last name or ids. */
function partnerView(p, myValues = [], photos = []) {
  return {
    photos,
    first_name: firstName(p.full_name),
    age: p.age,
    district: p.district,
    gender: p.gender,
    job_title: p.job_title,
    bio: p.bio,
    relationship_intention: p.relationship_intention,
    core_values: p.core_values || [],
    shared_values: (p.core_values || []).filter((v) => myValues.includes(v))
  };
}

async function matchView(match, userId) {
  const mine = match.user_one === userId;
  const partnerId = mine ? match.user_two : match.user_one;
  const live = ["proposed", "active"].includes(match.status);
  const shakeMatch = match.match_source === "shake";
  const persistentMatch = shakeMatch || match.match_source === "friend";
  const view = {
    id: match.id,
    status: match.status,
    is_shake_match: shakeMatch,
    is_persistent_chat: persistentMatch,
    i_accepted: mine ? match.user_one_accepted : match.user_two_accepted,
    partner_accepted: mine ? match.user_two_accepted : match.user_one_accepted,
    proposal_expires_at: match.proposal_expires_at,
    started_at: match.started_at,
    expires_at: match.expires_at,
    ended_reason: match.ended_reason,
    chat_open: live && (persistentMatch || (match.expires_at && new Date(match.expires_at) > new Date())),
    can_voice_message: match.status === "active" && (persistentMatch || (match.expires_at && new Date(match.expires_at) > new Date())),
    seconds_left: !persistentMatch && live && match.expires_at
      ? Math.max(0, Math.floor((new Date(match.expires_at) - Date.now()) / 1000)) : null
  };
  if (live) {
    const db = serviceClient();
    const [{ data: partner }, { data: me }, { data: consentRows, error: consentError }] = await Promise.all([
      db.from("profiles").select("full_name, age, district, gender, job_title, bio, relationship_intention, core_values, is_active, suspended_at, profile_visibility").eq("id", partnerId).maybeSingle(),
      db.from("profiles").select("core_values, is_active, suspended_at").eq("id", userId).maybeSingle(),
      shakeMatch
        ? db.from("shake_reveal_consents").select("user_id").eq("match_id", match.id)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (consentError) throw consentError;

    const revealState = shakeRevealState(match, userId, partnerId, consentRows);
    const revealed = revealState.revealed;
  const partnerHidden = partner?.profile_visibility === "hidden";
    if (shakeMatch) {
      view.reveal = {
        my_consented: revealState.my_consented,
        partner_consented: revealState.partner_consented,
        revealed
      };
    }

    const accountsActive = Boolean(partner?.is_active && !partner.suspended_at && me?.is_active && !me.suspended_at);
    view.chat_open = Boolean(view.chat_open && accountsActive);
    view.can_voice_message = Boolean(view.can_voice_message && accountsActive);

    // For Shake & Chat, fail closed: do not return profile fields or signed photos
    // until BOTH members have recorded consent on the server.
    if (partner && accountsActive && revealed && !partnerHidden) {
      const { data: photos } = await db.from("profile_photos")
        .select("id, object_path, sort_order").eq("user_id", partnerId)
        .eq("approval_status", "approved").order("sort_order");
      const visiblePhotos = [];
      for (const photo of photos || []) {
        const { data: signed } = await db.storage.from("profile-photos").createSignedUrl(photo.object_path, 600);
        if (signed?.signedUrl) visiblePhotos.push({ id: photo.id, url: signed.signedUrl, sort_order: photo.sort_order });
      }
      view.partner = partnerView(partner, me?.core_values || [], visiblePhotos);
    } else {
      view.partner = null;
    }
  }
  return view;
}

async function endLiveMatchesFor(userId, reason, actorId) {
  const db = serviceClient();
  const { data, error } = await db.from("match_members").select("match_id").eq("user_id", userId);
  if (error) throw error;
  for (const row of data || []) {
    const { error: endError } = await db.rpc("nivora_end_match", { p_user: userId, p_match: row.match_id, p_reason: reason });
    if (endError) throw endError;
  }
  return (data || []).length;
}

module.exports = { rpcError, expire, getMatchFor, assertLiveMatch, assertChatMatch, matchView, partnerView, endLiveMatchesFor };
