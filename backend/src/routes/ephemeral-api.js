"use strict";
const express = require("express");
const { randomUUID } = require("node:crypto");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { EphemeralStore } = require("../lib/ephemeral-store");
const { serviceClient } = require("../lib/clients");
const { clean, isUuid } = require("../lib/validation");
const { persistReport } = require("./moderation-api");

const router = express.Router();
router.use(requireAuth);

// All member-generated data lives only in this process and expires after 12 hours
// of inactivity. It is never written to Supabase tables or Storage.
const TTL = 12 * 60 * 60 * 1000;
const state = new EphemeralStore({ defaultTtlMs: TTL, maxEntries: 50000 });
const limited = createLimiter({ windowMs: 60 * 60_000, max: 100, keyFn: byUser });
const reportLimited = createLimiter({ windowMs: 60 * 60_000, max: 5, keyFn: byUser });
const REASONS = ["harassment", "fake_profile", "scam", "inappropriate_content", "underage", "other"];
const key = (type, id) => type + ":" + id;
const get = (k) => { const v = state.get(k); if (v !== undefined) state.set(k, v, TTL); return v; };
const put = (k, v) => state.set(k, v, TTL);
const list = (k) => get(k) || [];
const addUnique = (k, value) => { const a = list(k); if (!a.includes(value)) a.push(value); put(k, a.slice(-500)); };
const removeValue = (k, value) => put(k, list(k).filter(x => x !== value));
const now = () => new Date().toISOString();
const fail = (res, status, code, message) => res.status(status).json({ success: false, ...(code ? { code } : {}), message });
function distanceKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
}
function profileOf(id) { return get(key("profile", id)); }
function isBlocked(a, b) { return get(key("block", a + ":" + b)) === true || get(key("block", b + ":" + a)) === true; }
function compatible(a, b) {
  if (!a || !b || a.age < (b.min_partner_age || 18) || a.age > (b.max_partner_age || 100) ||
      b.age < (a.min_partner_age || 18) || b.age > (a.max_partner_age || 100)) return false;
  const accepts = (wanted, gender) => !wanted || wanted === "any" || wanted === gender;
  return accepts(a.looking_for, b.gender) && accepts(b.looking_for, a.gender);
}
function matchOf(id, userId) {
  const m = get(key("match", id));
  return m && m.status === "active" && (m.user_one === userId || m.user_two === userId) ? m : null;
}
function matchView(m, userId) {
  const partnerId = m.user_one === userId ? m.user_two : m.user_one;
  const reveal = m.reveal || {};
  const mine = m.user_one === userId ? reveal.one : reveal.two;
  const theirs = m.user_one === userId ? reveal.two : reveal.one;
  return {
    id: m.id, status: m.status, started_at: m.started_at, expires_at: null,
    is_shake_match: m.source === "shake", is_persistent_chat: true,
    match_source: m.source,
    reveal: { my_consented: Boolean(mine), partner_consented: Boolean(theirs), revealed: Boolean(mine && theirs), partner_hidden: !(mine && theirs) || profileOf(partnerId)?.profile_visibility === "hidden" },
    partner: mine && theirs && profileOf(partnerId)?.profile_visibility !== "hidden" ? profileOf(partnerId) : null
  };
}
function createMatch(a, b, source = "shake") {
  const existing = list(key("matches", a)).map(id => get(key("match", id))).find(m => m && m.status === "active" && [m.user_one, m.user_two].includes(b));
  if (existing) return existing;
  const m = { id: randomUUID(), user_one: a, user_two: b, source, status: "active", started_at: now(), reveal: { one: false, two: false } };
  put(key("match", m.id), m); addUnique(key("matches", a), m.id); addUnique(key("matches", b), m.id);
  return m;
}
function liveMatch(req, res) {
  const m = matchOf(req.params.matchId || req.params.id, req.user.id);
  if (!m) { fail(res, 404, "match_not_live", "This conversation is unavailable or has ended."); return null; }
  if (isBlocked(m.user_one, m.user_two)) { m.status = "ended"; put(key("match", m.id), m); fail(res, 403, "blocked", "This connection is unavailable."); return null; }
  return m;
}
function requireProfile(req, res) {
  const p = profileOf(req.user.id);
  if (!p) { fail(res, 403, "profile_unavailable", "Create your profile to use BEYOND."); return null; }
  return p;
}

// Profile data is session-only. No profile row is inserted into Supabase.
router.get("/profile", (req, res) => res.json({ success: true, profile: profileOf(req.user.id) || null, staff: false }));
router.post("/profile", limited, (req, res) => saveProfile(req, res, true));
router.put("/profile", limited, (req, res) => saveProfile(req, res, false));
function saveProfile(req, res, creating) {
  const b = req.body || {};
  const name = clean(b.full_name || "").slice(0, 80);
  const age = Number(b.age);
  const district = clean(b.district || "").slice(0, 100);
  const values = Array.isArray(b.core_values) ? [...new Set(b.core_values.map(x => clean(x).slice(0, 40)).filter(Boolean))].slice(0, 5) : [];
  if (creating && (b.consents?.terms !== true || b.consents?.privacy !== true)) return fail(res, 400, "consent_required", "Accept the Terms and Privacy Notice to continue.");
  if (name.length < 2 || !Number.isInteger(age) || age < 18 || age > 100 || !district || !values.length) {
    return fail(res, 400, "invalid_profile", "Enter a name, age 18 or older, location and at least one interest.");
  }
  const current = profileOf(req.user.id);
  if (creating && current) return fail(res, 409, "profile_exists", "A profile already exists. Edit it instead.");
  const p = {
    ...(current || {}), id: req.user.id, full_name: name, first_name: name.split(/\s+/)[0], age, district, profile_complete: true, suspended: false,
    gender: ["woman", "man", "other"].includes(b.gender) ? b.gender : "other",
    job_title: clean(b.job_title || "").slice(0, 100), bio: clean(b.bio || "").slice(0, 1000),
    looking_for: ["woman", "man", "any"].includes(b.looking_for) ? b.looking_for : "any",
    relationship_intention: ["marriage", "longterm"].includes(b.relationship_intention) ? b.relationship_intention : "longterm",
    min_partner_age: Math.max(18, Math.min(100, Number(b.min_partner_age) || 18)),
    max_partner_age: Math.max(18, Math.min(100, Number(b.max_partner_age) || 100)),
    core_values: values, approval_status: "approved", is_active: true,
    profile_visibility: current?.profile_visibility || "public",
    created_at: current?.created_at || now(), updated_at: now()
  };
  if (p.min_partner_age > p.max_partner_age) return fail(res, 400, "invalid_age_range", "Partner age range is invalid.");
  put(key("profile", req.user.id), p);
  res.status(creating ? 201 : 200).json({ success: true, profile: p, message: "Profile is active for this session." });
}
router.put("/profile/visibility", limited, (req, res) => {
  const p = requireProfile(req, res); if (!p) return;
  if (!["public", "hidden"].includes(req.body?.visibility)) return fail(res, 400, "invalid_visibility", "Choose public or hidden.");
  p.profile_visibility = req.body.visibility; put(key("profile", req.user.id), p);
  res.json({ success: true, visibility: p.profile_visibility });
});

// Discovery coordinates, radius and interests remain volatile and are never logged.
router.get("/shake/status", (req, res) => {
  const l = get(key("location", req.user.id));
  res.json({ success: true, enabled: Boolean(l), radius_km: l?.radius_km || 25, updated_at: l?.updated_at || null });
});
router.post("/shake/location", limited, (req, res) => {
  if (!requireProfile(req, res)) return;
  const latitude = Number(req.body?.latitude), longitude = Number(req.body?.longitude), radius_km = Number(req.body?.radius_km ?? 25);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isInteger(radius_km) || radius_km < 1 || radius_km > 100) return fail(res, 400, "invalid_location", "Choose a radius from 1 to 100 km and allow location access.");
  put(key("location", req.user.id), { latitude, longitude, radius_km, updated_at: now() });
  res.json({ success: true, enabled: true, radius_km });
});
router.delete("/shake/location", limited, (req, res) => {
  state.delete(key("location", req.user.id));
  res.json({ success: true, enabled: false });
});
router.get("/shake/discover", (req, res) => {
  const mine = requireProfile(req, res); if (!mine) return;
  const loc = get(key("location", req.user.id));
  if (!loc) return fail(res, 409, "location_opt_in_required", "Enable nearby discovery first.");
  const people = [];
  for (const [k, otherLoc] of state.entries()) {
    if (!k.startsWith("location:") || k === key("location", req.user.id)) continue;
    const id = k.slice("location:".length), p = profileOf(id);
    if (!p || p.profile_visibility !== "public" || isBlocked(req.user.id, id) || !compatible(mine, p)) continue;
    const dist = distanceKm(loc, otherLoc);
    if (dist > loc.radius_km || dist > otherLoc.radius_km) continue;
    const interested = get(key("interest", id + ":" + req.user.id)) === true;
    const already = list(key("matches", req.user.id)).some(mid => { const m = get(key("match", mid)); return m?.status === "active" && [m.user_one, m.user_two].includes(id); });
    if (!already) { const candidate_token = randomUUID(); put(key("candidate", req.user.id + ":" + candidate_token), id); people.push({ candidate_token, display_name: "Anonymous member", interests: p.core_values || [], distance_km: Math.max(1, Math.round(dist)), interested_in_you: interested }); }
  }
  people.sort((a,b) => a.distance_km - b.distance_km);
  res.json({ success: true, radius_km: loc.radius_km, people: people.slice(0, 50) });
});
router.post("/shake/interest", limited, (req, res) => {
  const token = req.body?.candidate_token, mine = requireProfile(req, res);
  if (!mine) return;
  const target = typeof token === "string" ? get(key("candidate", req.user.id + ":" + token)) : null;
  if (!target || !profileOf(target) || profileOf(target).profile_visibility !== "public") return fail(res, 404, "invalid_target", "Member not found.");
  state.delete(key("candidate", req.user.id + ":" + token));
  if (!compatible(mine, profileOf(target))) return fail(res, 409, "not_compatible", "This member is not compatible with your discovery preferences.");
  if (isBlocked(req.user.id, target)) return fail(res, 403, "blocked", "This connection is unavailable.");
  const a = get(key("location", req.user.id)), b = get(key("location", target));
  if (!a || !b) return fail(res, 409, "location_not_enabled", "Nearby discovery is no longer enabled.");
  if (distanceKm(a, b) > Math.min(a.radius_km, b.radius_km)) return fail(res, 409, "outside_radius", "This member is outside the selected radius.");
  put(key("interest", req.user.id + ":" + target), true);
  if (get(key("interest", target + ":" + req.user.id))) {
    const m = createMatch(req.user.id, target, "shake");
    return res.json({ success: true, mutual: true, match_id: m.id });
  }
  res.json({ success: true, mutual: false });
});
router.post("/shake/:matchId/reveal", limited, (req, res) => reveal(req, res, true));
router.delete("/shake/:matchId/reveal", limited, (req, res) => reveal(req, res, false));
function reveal(req, res, consent) {
  const m = liveMatch(req, res); if (!m) return;
  if (m.source !== "shake") return fail(res, 400, "invalid_match", "This is not a Shake & Chat connection.");
  const field = m.user_one === req.user.id ? "one" : "two";
  m.reveal[field] = consent; put(key("match", m.id), m);
  res.json({ success: true, revealed: Boolean(m.reveal.one && m.reveal.two), my_consented: m.reveal[field], partner_consented: m.reveal[field === "one" ? "two" : "one"] });
}

// Match list is current-session only. There is deliberately no match history.
router.get("/match/current", (req, res) => {
  const matches = list(key("matches", req.user.id)).map(id => get(key("match", id))).filter(m => m?.status === "active").map(m => matchView(m, req.user.id));
  matches.sort((a,b) => String(b.started_at).localeCompare(String(a.started_at)));
  res.json({ success: true, matches, match: matches[0] || null });
});
router.get("/match/history", (_req, res) => res.json({ success: true, history: [] }));
router.post("/match/find", (_req, res) => fail(res, 410, "retired", "Use Shake & Chat to discover people."));
router.post("/match/:id/respond", (req, res) => {
  const m = matchOf(req.params.id, req.user.id); if (!m) return fail(res, 404, "match_not_live", "Conversation not found.");
  if (typeof req.body?.accept !== "boolean") return fail(res, 400, "invalid_response", "Invalid response.");
  if (!req.body.accept) { m.status = "ended"; put(key("match", m.id), m); state.delete(key("messages", m.id)); }
  res.json({ success: true, status: m.status, match: matchView(m, req.user.id) });
});
router.post("/match/:id/end", (req, res) => {
  const m = matchOf(req.params.id, req.user.id); if (!m) return fail(res, 404, "match_not_live", "Conversation not found.");
  m.status = "ended"; put(key("match", m.id), m); state.delete(key("messages", m.id));
  res.json({ success: true, status: "ended" });
});

// Chat text exists only in RAM and expires with the session. Voice uploads are disabled.
router.get("/chat/:matchId/messages", (req, res) => {
  const m = liveMatch(req, res); if (!m) return;
  const after = req.query.after ? Date.parse(req.query.after) : 0;
  const messages = list(key("messages", m.id)).filter(x => Date.parse(x.created_at) > after).map(x => ({ id:x.id, body:x.body, created_at:x.created_at, mine:x.sender_id === req.user.id }));
  res.json({ success: true, messages, expires_at: null });
});
router.post("/chat/:matchId/messages", limited, (req, res) => {
  const m = liveMatch(req, res); if (!m) return;
  const body = clean(req.body?.body || "");
  if (!body || body.length > 2000) return fail(res, 400, "invalid_message", "Message must be 1–2000 characters.");
  const msg = { id: randomUUID(), sender_id: req.user.id, body, created_at: now(), mine: true };
  const messages = list(key("messages", m.id)); messages.push(msg); put(key("messages", m.id), messages.slice(-200));
  res.status(201).json({ success: true, message: { id:msg.id, body:msg.body, created_at:msg.created_at, mine:true } });
});
router.get("/chat/:matchId/voice", (req, res) => {
  if (!liveMatch(req, res)) return;
  res.json({ success: true, voice_messages: [] });
});
router.post("/chat/:matchId/voice", (_req, res) => fail(res, 410, "voice_disabled", "Voice messages are disabled because BEYOND does not retain uploaded media."));

// Anonymous posts are volatile. No media attachments are supported.
router.get("/community/feed", (req, res) => {
  if (!requireProfile(req, res)) return;
  const mineLoc = get(key("location", req.user.id));
  const posts = list("community:posts").filter(p => Date.now() - Date.parse(p.created_at) < TTL && (() => {
    if (isBlocked(req.user.id, p.author_id)) return false;
    if (p.audience !== "radius" || p.author_id === req.user.id) return true;
    const authorLoc = get(key("location", p.author_id));
    return Boolean(mineLoc && authorLoc && distanceKm(mineLoc, authorLoc) <= p.radius_km);
  })()).map(p => ({ id:p.id, body:p.body, audience:p.audience, created_at:p.created_at, mine:p.author_id === req.user.id }));
  res.json({ success: true, posts });
});
router.post("/community/posts", limited, (req, res) => {
  if (!requireProfile(req, res)) return;
  const body = clean(req.body?.body || "");
  if (!body || body.length > 2000) return fail(res, 400, "invalid_post", "Posts must be 1–2000 characters.");
  const audience = req.body?.audience === "radius" ? "radius" : "global";
  const radius_km = Number(req.body?.radius_km ?? 25);
  if (audience === "radius" && (!Number.isInteger(radius_km) || radius_km < 1 || radius_km > 100 || !get(key("location", req.user.id)))) return fail(res, 409, "location_required", "Enable nearby discovery before publishing to a radius.");
  const post = { id: randomUUID(), author_id:req.user.id, body, audience, radius_km: audience === "radius" ? radius_km : null, created_at:now() };
  const posts = list("community:posts").filter(p => Date.now() - Date.parse(p.created_at) < TTL); posts.unshift(post); put("community:posts", posts.slice(0, 500));
  res.status(201).json({ success:true, post:{ id:post.id, body:post.body, audience:post.audience, created_at:post.created_at } });
});
router.delete("/community/posts/:id", (req,res) => {
  const posts = list("community:posts"), post = posts.find(p => p.id === req.params.id && p.author_id === req.user.id);
  if (!post) return fail(res,404,"post_not_found","Post not found.");
  put("community:posts", posts.filter(p => p.id !== post.id)); res.json({success:true});
});
router.post("/community/posts/:id/report", limited, (req,res) => {
  const post = list("community:posts").find(p => p.id === req.params.id);
  if (!post || post.author_id === req.user.id) return fail(res,404,"post_not_found","Post not found.");
  if (!REASONS.includes(req.body?.reason)) return fail(res,400,"invalid_reason","Choose a valid report reason.");
  persistReport({ reporterId:req.user.id, reportedId:post.author_id, reason:req.body.reason, details:req.body.details || "" })
    .then(() => res.status(201).json({success:true,message:"Report received. Safety records are retained for moderation for up to 90 days."}))
    .catch(err => fail(res, err.status || 503, "report_save_failed", err.status ? err.message : "Could not save the report. Please try again."));
});
router.post("/community/posts/:id/block", limited, (req,res) => {
  const post = list("community:posts").find(p => p.id === req.params.id);
  if (!post || post.author_id === req.user.id) return fail(res,404,"post_not_found","Post not found.");
  blockUser(req.user.id, post.author_id); res.json({success:true,message:"Member blocked for this active server session."});
});

// Mutual friend requests. Both request and acceptance exist only in volatile memory.
router.get("/friends", (req,res) => {
  const friends = list(key("friends",req.user.id)).map(id => {
    const p=profileOf(id); return {friend_id:id,display_name:p && p.profile_visibility !== "hidden" ? (p.first_name || "BEYOND member") : "BEYOND member",age:p && p.profile_visibility !== "hidden" ? p.age : null,district:p && p.profile_visibility !== "hidden" ? p.district : null};
  });
  res.json({success:true,friends});
});
router.get("/friends/requests", (req,res) => res.json({success:true,incoming:list(key("friend-in",req.user.id)).map(r=>({id:r.id,created_at:r.created_at})),outgoing:list(key("friend-out",req.user.id)).map(r=>({id:r.id,created_at:r.created_at}))}));
router.post("/friends/request", limited, (req,res) => {
  const m=matchOf(req.body?.match_id,req.user.id); if(!m) return fail(res,404,"match_not_found","Active chat required.");
  const partner=m.user_one===req.user.id?m.user_two:m.user_one;
  if(isBlocked(req.user.id,partner)) return fail(res,403,"blocked","This connection is unavailable.");
  const id=randomUUID(), request={id,sender_id:req.user.id,recipient_id:partner,created_at:now()};
  const incoming=list(key("friend-in",partner)); if (incoming.length >= 100) return fail(res,429,"request_limit","This member has too many pending requests."); incoming.push(request); put(key("friend-in",partner),incoming);
  const outgoing=list(key("friend-out",req.user.id)); outgoing.push(request); put(key("friend-out",req.user.id),outgoing);
  res.status(201).json({success:true,request_id:id});
});
router.post("/friends/requests/:id/respond", limited, (req,res) => {
  const incoming=list(key("friend-in",req.user.id)), request=incoming.find(x=>x.id===req.params.id);
  if(!request) return fail(res,404,"request_not_found","Friend request not found.");
  put(key("friend-in",req.user.id),incoming.filter(x=>x.id!==request.id));
  const outgoing=list(key("friend-out",request.sender_id)); put(key("friend-out",request.sender_id),outgoing.filter(x=>x.id!==request.id));
  if(req.body?.accept===true) { addUnique(key("friends",req.user.id),request.sender_id); addUnique(key("friends",request.sender_id),req.user.id); }
  res.json({success:true,accepted:req.body?.accept===true});
});
router.post("/friends/:id/chat", (req,res) => {
  if(!list(key("friends",req.user.id)).includes(req.params.id)) return fail(res,403,"not_friends","You are not friends yet.");
  const m=createMatch(req.user.id,req.params.id,"friend"); res.json({success:true,match_id:m.id});
});

function blockUser(userId, targetId) {
  put(key("block",userId+":"+targetId),true);
  removeValue(key("friends",userId),targetId); removeValue(key("friends",targetId),userId);
  for(const mid of list(key("matches",userId))) { const m=get(key("match",mid)); if(m && [m.user_one,m.user_two].includes(targetId)) { m.status="ended"; put(key("match",mid),m); state.delete(key("messages",mid)); } }
  for(const k of ["friend-in:"+userId,"friend-out:"+userId,"friend-in:"+targetId,"friend-out:"+targetId]) put(k,list(k).filter(r=>r.sender_id!==targetId && r.recipient_id!==targetId));
}
router.post("/safety/block", limited, (req,res) => {
  const m=matchOf(req.body?.match_id,req.user.id); if(!m) return fail(res,404,"match_not_found","Match not found.");
  const partner=m.user_one===req.user.id?m.user_two:m.user_one; blockUser(req.user.id,partner);
  res.json({success:true,message:"Member blocked. The active conversation is closed."});
});
router.post("/safety/report", reportLimited, (req,res) => {
  const m=matchOf(req.body?.match_id,req.user.id); if(!m) return fail(res,404,"match_not_found","Match not found.");
  if(!REASONS.includes(req.body?.reason)) return fail(res,400,"invalid_reason","Choose a valid report reason.");
  const partner=m.user_one===req.user.id?m.user_two:m.user_one;
  persistReport({ reporterId:req.user.id, reportedId:partner, reason:req.body.reason, details:req.body.details || "" })
    .then(() => res.status(201).json({success:true,message:"Report received. Safety records are retained for moderation for up to 90 days."}))
    .catch(err => fail(res, err.status || 503, "report_save_failed", err.status ? err.message : "Could not save the report. Please try again."));
});
router.post("/feedback", (req,res) => {
  const feedback=clean(req.body?.feedback||req.body?.message||"");
  if(!feedback || feedback.length>1000) return fail(res,400,"invalid_feedback","Feedback must be 1–1000 characters.");
  const rows=list("feedback"); rows.push({user_id:req.user.id,feedback,created_at:now()}); put("feedback",rows.slice(-500));
  res.status(201).json({success:true});
});

// Clear every volatile item associated with this member on explicit logout.
router.delete("/session", (req, res) => {
  const id = req.user.id;
  for (const [k, value] of state.entries()) {
    let remove = k.endsWith(":" + id) || k.includes(":" + id + ":");
    if (k.startsWith("match:") && value && [value.user_one, value.user_two].includes(id)) {
      state.delete(key("messages", value.id)); remove = true;
    }
    if (k === "community:posts") put(k, value.filter(p => p.author_id !== id));
    else if (k === "safety:reports") put(k, value.filter(r => r.reporter_id !== id && r.reported_id !== id));
    else if (k === "feedback") put(k, value.filter(r => r.user_id !== id));
    else if (Array.isArray(value) && (k.startsWith("friend-in:") || k.startsWith("friend-out:"))) {
      put(k, value.filter(r => r.sender_id !== id && r.recipient_id !== id));
    } else if (Array.isArray(value) && k.startsWith("friends:")) {
      put(k, value.filter(friendId => friendId !== id));
    } else if (remove) state.delete(k);
  }
  res.json({ success: true, cleared: true });
});

// Export contains only the active in-memory session state. No historic content exists.
router.get("/account/export", (req,res) => {
  const profile=profileOf(req.user.id);
  res.json({success:true,exported_at:now(),profile,matches:[],feedback:[],messages:[],payments:[],photos:[],voice_messages:[]});
});
router.delete("/account", async (req,res) => {
  if(req.body?.confirm!=="DELETE") return fail(res,400,"confirmation_required",'Send {"confirm":"DELETE"} to delete your login account.');
  const id=req.user.id;
  for (const [k, value] of state.entries()) {
    if (k.startsWith("match:") && value && [value.user_one, value.user_two].includes(id)) {
      state.delete(key("messages", value.id)); state.delete(k);
    } else if (k === "community:posts") put(k, value.filter(p => p.author_id !== id));
    else if (k === "safety:reports") put(k, value.filter(r => r.reporter_id !== id && r.reported_id !== id));
    else if (k === "feedback") put(k, value.filter(r => r.user_id !== id));
    else if (Array.isArray(value) && (k.startsWith("friend-in:") || k.startsWith("friend-out:"))) put(k, value.filter(r => r.sender_id !== id && r.recipient_id !== id));
    else if (Array.isArray(value) && k.startsWith("friends:")) put(k, value.filter(friendId => friendId !== id));
    else if (k.endsWith(":" + id) || k.includes(":" + id + ":")) state.delete(k);
  }
  try {
    const {error}=await serviceClient().auth.admin.deleteUser(id);
    if(error) return fail(res,500,"account_delete_failed","The login account could not be deleted. Contact support.");
  } catch { return fail(res,503,"account_delete_unavailable","Account deletion is temporarily unavailable."); }
  res.json({success:true,message:"Your BEYOND login account has been deleted."});
});

// Photos, voice, payments and admin console are intentionally unavailable in minimal-data mode.
router.get("/profile/photos", (_req,res)=>res.json({success:true,photos:[]}));
router.post("/profile/photos", (_req,res)=>fail(res,410,"photos_disabled","Photo uploads are disabled. BEYOND does not retain photos."));
router.delete("/profile/photos/:id", (_req,res)=>res.json({success:true}));
router.get("/admin/me", (_req,res)=>fail(res,403,"not_staff","Staff access is not enabled in minimal-data mode."));
router.use((req,res)=>fail(res,410,"feature_disabled","This feature is disabled in BEYOND's minimal-data mode."));
module.exports = router;
