"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid } = require("../lib/validation");

const router = express.Router();
router.use(requireAuth);
const locationLimit = createLimiter({ windowMs: 60 * 60_000, max: 8, keyFn: byUser });
const discoverLimit = createLimiter({ windowMs: 60 * 60_000, max: 30, keyFn: byUser });
const interestLimit = createLimiter({ windowMs: 60 * 60_000, max: 20, keyFn: byUser });

function distanceKm(aLat, aLon, bLat, bLon) {
  const rad = (n) => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
function compatible(a, b) {
  return (a.looking_for === "any" || a.looking_for === b.gender) &&
    (b.looking_for === "any" || b.looking_for === a.gender) &&
    b.age >= a.min_partner_age && b.age <= a.max_partner_age &&
    a.age >= b.min_partner_age && a.age <= b.max_partner_age;
}
async function currentCustomer(db, userId) {
  const [{ data: staff, error: staffError }, { data: profile, error }] = await Promise.all([
    db.from("staff_roles").select("user_id").eq("user_id", userId).maybeSingle(),
    db.from("profiles").select("id,age,gender,looking_for,min_partner_age,max_partner_age,approval_status,is_active,suspended_at,profile_visibility").eq("id", userId).maybeSingle()
  ]);
  if (staffError || error) throw new Error("account_check_failed");
  if (staff) return { error: "staff_not_customer" };
  if (!profile || profile.approval_status !== "approved" || !profile.is_active || profile.suspended_at) return { error: "profile_unavailable" };
  return { profile };
}

router.get("/status", async (req, res) => {
  const db = serviceClient();
  const { data, error } = await db.from("shake_locations").select("enabled,updated_at").eq("user_id", req.user.id).maybeSingle();
  if (error) return res.status(500).json({ success: false, message: "Could not check discovery settings." });
  res.json({ success: true, enabled: Boolean(data?.enabled), radius_km: data?.radius_km || 25, updated_at: data?.updated_at || null });
});

router.post("/location", locationLimit, async (req, res) => {
  const lat = Number(req.body?.latitude), lon = Number(req.body?.longitude);
  const radius = Number(req.body?.radius_km ?? 25);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || !Number.isInteger(radius) || radius < 1 || radius > 100) {
    return res.status(400).json({ success: false, message: "Valid location coordinates are required." });
  }
  const db = serviceClient();
  try {
    const customer = await currentCustomer(db, req.user.id);
    if (customer.error) return res.status(403).json({ success: false, code: customer.error, message: "Your customer profile is not eligible for Shake & Chat." });
    const { error } = await db.from("shake_locations").upsert({
      user_id: req.user.id, latitude: lat, longitude: lon, radius_km: radius, enabled: true, updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (error) return res.status(500).json({ success: false, message: "Could not save your discovery location." });
    return res.json({ success: true, enabled: true, radius_km: radius, message: "Shake & Chat is enabled." });
  } catch {
    return res.status(503).json({ success: false, message: "Account eligibility could not be checked." });
  }
});

router.delete("/location", locationLimit, async (req, res) => {
  const { error } = await serviceClient().from("shake_locations").delete().eq("user_id", req.user.id);
  if (error) return res.status(500).json({ success: false, message: "Could not turn off location discovery." });
  res.json({ success: true, enabled: false });
});

router.get("/discover", discoverLimit, async (req, res) => {
  const db = serviceClient();
  try {
    const customer = await currentCustomer(db, req.user.id);
    if (customer.error) return res.status(403).json({ success: false, code: customer.error, message: "Your customer profile is not eligible for Shake & Chat." });
    const { data: mine, error: mineError } = await db.from("shake_locations").select("latitude,longitude,enabled,radius_km").eq("user_id", req.user.id).maybeSingle();
    if (mineError) return res.status(500).json({ success: false, message: "Could not load your discovery location." });
    if (!mine?.enabled) return res.status(409).json({ success: false, code: "location_opt_in_required", message: "Enable optional location sharing to discover people nearby." });

    const { data: locations, error: locError } = await db.from("shake_locations")
      .select("user_id,latitude,longitude").eq("enabled", true).neq("user_id", req.user.id).limit(2000);
    if (locError) return res.status(500).json({ success: false, message: "Nearby members could not be loaded." });
    const nearby = (locations || []).map((loc) => ({ id: loc.user_id, distance: distanceKm(mine.latitude, mine.longitude, loc.latitude, loc.longitude) }))
      .filter((x) => x.distance <= (mine.radius_km || 25));
    if (!nearby.length) return res.json({ success: true, radius_km: mine.radius_km || 25, people: [] });

    const ids = nearby.map((x) => x.id);
    const [{ data: profiles, error: profileError }, { data: blocks, error: blockError }, { data: outgoing, error: outgoingError }, { data: incoming, error: incomingError }, { data: activeMatches, error: activeError }] = await Promise.all([
      db.from("profiles").select("id,full_name,age,district,gender,looking_for,min_partner_age,max_partner_age,job_title,bio,relationship_intention,core_values,is_active,suspended_at,approval_status,profile_visibility").in("id", ids).eq("approval_status", "approved").eq("is_active", true).eq("profile_visibility", "public"),
      db.from("blocks").select("blocker_id,blocked_id").or("blocker_id.eq." + req.user.id + ",blocked_id.eq." + req.user.id),
      db.from("shake_interests").select("to_user").eq("from_user", req.user.id),
      db.from("shake_interests").select("from_user").eq("to_user", req.user.id),
      db.from("match_history").select("user_one,user_two,status,expires_at,proposal_expires_at,match_source").in("status", ["proposed", "active"]).or("user_one.eq." + req.user.id + ",user_two.eq." + req.user.id).limit(2000)
    ]);
    if (profileError || blockError || outgoingError || incomingError || activeError) return res.status(500).json({ success: false, message: "Nearby member privacy checks failed." });
    const hidden = new Set();
    for (const b of blocks || []) hidden.add(b.blocker_id === req.user.id ? b.blocked_id : b.blocker_id);
    const sent = new Set((outgoing || []).map((x) => x.to_user));
    const received = new Set((incoming || []).map((x) => x.from_user));
    const alreadyMatched = new Set((activeMatches || []).filter((x) => x.status === "active" && x.match_source === "shake" || (() => { const expiry = x.status === "proposed" ? x.proposal_expires_at : x.expires_at; return expiry && new Date(expiry).getTime() > Date.now(); })()).map((x) => x.user_one === req.user.id ? x.user_two : x.user_one));
    const byId = new Map((profiles || []).map((p) => [p.id, p]));
    const people = nearby.filter((n) => !hidden.has(n.id) && !alreadyMatched.has(n.id) && !sent.has(n.id))
      .map((n) => {
        const person = byId.get(n.id);
        if (!person || !compatible(customer.profile, person) || person.suspended_at) return null;
        return {
          user_id: person.id, first_name: String(person.full_name || "").trim().split(/\s+/)[0],
          age: person.age, district: person.district, job_title: person.job_title,
          bio: person.bio, relationship_intention: person.relationship_intention,
          core_values: person.core_values || [], distance_km: Math.max(1, Math.round(n.distance)),
          interested_in_you: received.has(n.id)
        };
      }).filter(Boolean).sort((a, b) => a.distance_km - b.distance_km).slice(0, 50);
    res.json({ success: true, radius_km: mine.radius_km || 25, people });
  } catch {
    res.status(503).json({ success: false, message: "Account eligibility could not be checked." });
  }
});

router.post("/interest", interestLimit, async (req, res) => {
  const target = req.body?.target_user_id;
  if (!isUuid(target) || target === req.user.id) return res.status(400).json({ success: false, message: "Invalid member." });
  const { data, error } = await serviceClient().rpc("nivora_shake_mutual_interest", { p_user: req.user.id, p_target: target });
  if (error) {
    const code = String(error.message || "").trim();
    const messages = {
      invalid_target: [400, "Invalid member."], staff_not_customer: [403, "Staff accounts cannot use Shake & Chat."],
      profile_unavailable: [403, "One of these profiles is unavailable."], not_compatible: [409, "These profiles are not compatible."],
      blocked: [403, "This connection is unavailable."], location_not_enabled: [409, "Location discovery is no longer enabled."],
      outside_radius: [409, "This member is outside your selected radius."], existing_match: [409, "You already have a conversation with this member."]
    };
    const mapped = messages[code];
    if (mapped) return res.status(mapped[0]).json({ success: false, code, message: mapped[1] });
    console.error("Shake & Chat interest RPC failed:", error.code || "unknown");
    return res.status(500).json({ success: false, message: "Interest could not be sent." });
  }
  res.json({ success: true, ...data });
});

// Both members must consent before matchView returns any Shake & Chat identity.
router.post("/:matchId/reveal", interestLimit, async (req, res) => {
  if (!isUuid(req.params.matchId)) return res.status(400).json({ success: false, message: "Invalid match." });
  const { data, error } = await serviceClient().rpc("nivora_shake_set_reveal_consent", {
    p_user: req.user.id, p_match: req.params.matchId, p_consent: true
  });
  if (error) {
    const code = String(error.message || "").trim();
    const map = {
      match_not_found: [404, "Shake & Chat match not found."],
      match_not_live: [409, "This Shake & Chat conversation is closed."],
      blocked: [403, "This connection is unavailable."],
      account_unavailable: [403, "This account is unavailable."]
    };
    if (map[code]) return res.status(map[code][0]).json({ success: false, code, message: map[code][1] });
    console.error("Shake reveal consent failed:", error.code || "unknown");
    return res.status(500).json({ success: false, message: "Reveal consent could not be saved." });
  }
  res.json({ success: true, ...data });
});

router.delete("/:matchId/reveal", interestLimit, async (req, res) => {
  if (!isUuid(req.params.matchId)) return res.status(400).json({ success: false, message: "Invalid match." });
  const { data, error } = await serviceClient().rpc("nivora_shake_set_reveal_consent", {
    p_user: req.user.id, p_match: req.params.matchId, p_consent: false
  });
  if (error) {
    const code = String(error.message || "").trim();
    const map = {
      match_not_found: [404, "Shake & Chat match not found."],
      match_not_live: [409, "This Shake & Chat conversation is closed."],
      blocked: [403, "This connection is unavailable."],
      account_unavailable: [403, "This account is unavailable."],
      reveal_already_completed: [409, "Both members have already revealed their profiles."]
    };
    if (map[code]) return res.status(map[code][0]).json({ success: false, code, message: map[code][1] });
    console.error("Shake reveal consent withdrawal failed:", error.code || "unknown");
    return res.status(500).json({ success: false, message: "Reveal choice could not be updated." });
  }
  res.json({ success: true, ...data });
});

module.exports = router;
