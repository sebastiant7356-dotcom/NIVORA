"use strict";
const { serviceClient } = require("./clients");
const { firstName } = require("./validation");

const ERROR_MAP = {
  profile_missing: [404, "Create your profile first."],
  not_approved: [403, "Your profile must be approved by staff first."],
  inactive: [403, "Your account is not active."],
  profile_incomplete: [409, "Please complete your profile (gender, preferences, values) first."],
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
  if (match.status !== "active" || !match.expires_at || new Date(match.expires_at) <= new Date()) {
    return { status: 403, code: "match_not_live", message: "This conversation is closed (the match ended or the 72-hour window is over)." };
  }
  const partnerId = match.user_one === userId ? match.user_two : match.user_one;
  const { data: blocked } = await serviceClient().from("blocks").select("blocker_id")
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${partnerId}),and(blocker_id.eq.${partnerId},blocked_id.eq.${userId})`).limit(1);
  if (blocked && blocked.length) return { status: 403, code: "blocked", message: "This conversation is closed." };
  return { match, partnerId };
}

/** Only fields a matched user may see. Never phone, email, last name or ids. */
function partnerView(p, myValues = []) {
  return {
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
  const view = {
    id: match.id,
    status: match.status,
    i_accepted: mine ? match.user_one_accepted : match.user_two_accepted,
    partner_accepted: mine ? match.user_two_accepted : match.user_one_accepted,
    proposal_expires_at: match.proposal_expires_at,
    started_at: match.started_at,
    expires_at: match.expires_at,
    ended_reason: match.ended_reason,
    chat_open: match.status === "active" && match.expires_at && new Date(match.expires_at) > new Date(),
    seconds_left: match.status === "active" && match.expires_at
      ? Math.max(0, Math.floor((new Date(match.expires_at) - Date.now()) / 1000)) : null
  };
  if (live) {
    const db = serviceClient();
    const [{ data: partner }, { data: me }] = await Promise.all([
      db.from("profiles").select("full_name, age, district, gender, job_title, bio, relationship_intention, core_values").eq("id", partnerId).maybeSingle(),
      db.from("profiles").select("core_values").eq("id", userId).maybeSingle()
    ]);
    view.partner = partner ? partnerView(partner, me?.core_values || []) : null;
  }
  return view;
}

async function endLiveMatchesFor(userId, reason, actorId) {
  const db = serviceClient();
  const { data } = await db.from("match_members").select("match_id").eq("user_id", userId);
  for (const row of data || []) {
    await db.rpc("nivora_end_match", { p_user: userId, p_match: row.match_id, p_reason: reason });
  }
  return (data || []).length;
}

module.exports = { rpcError, expire, getMatchFor, assertLiveMatch, matchView, partnerView, endLiveMatchesFor };
