"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { clean, isKeralaDistrict, isUuid } = require("../lib/validation");
const { audit } = require("../lib/audit");

const router = express.Router();
router.use(requireAuth);
const postLimit = createLimiter({ windowMs: 60 * 60_000, max: 10, keyFn: byUser });

async function eligibleKeralaMember(db, userId) {
  const { data, error } = await db.from("profiles")
    .select("district,approval_status,is_active,suspended_at")
    .eq("id", userId).maybeSingle();
  return !error && data && data.approval_status === "approved" && data.is_active &&
    !data.suspended_at && isKeralaDistrict(data.district);
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const rad = (n) => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

router.get("/feed", async (req, res) => {
  const db = serviceClient();
  if (!(await eligibleKeralaMember(db, req.user.id))) return res.status(403).json({ success: false, message: "NIVORA community is currently for members in Kerala only." });
  const { data: rows, error } = await db.from("anonymous_posts")
    .select("id,author_id,body,audience,radius_km,latitude,longitude,created_at")
    .eq("status", "published").order("created_at", { ascending: false }).limit(100);
  if (error) return res.status(500).json({ success: false, message: "Could not load the community feed." });
  const { data: blockedRows } = await db.from("blocks").select("blocked_id").eq("blocker_id", req.user.id);
  const blockedIds = new Set((blockedRows || []).map((row) => row.blocked_id));
  const radiusRows = (rows || []).filter((p) => p.audience === "radius" && !blockedIds.has(p.author_id));
  let mine = null, authorLocations = [];
  if (radiusRows.length) {
    const { data: loc } = await db.from("shake_locations").select("latitude,longitude").eq("user_id", req.user.id).eq("enabled", true).maybeSingle();
    mine = loc;
    const authorIds = [...new Set(radiusRows.map((p) => p.author_id))];
    const { data } = await db.from("shake_locations").select("user_id,latitude,longitude").in("user_id", authorIds).eq("enabled", true);
    authorLocations = data || [];
  }
  const locById = new Map(authorLocations.map((x) => [x.user_id, x]));
  const visible = (rows || []).filter((p) => {
    if (blockedIds.has(p.author_id)) return false;
    if (p.audience === "kerala") return true;
    const loc = locById.get(p.author_id);
    return Boolean(mine && loc && distanceKm(mine.latitude, mine.longitude, loc.latitude, loc.longitude) <= p.radius_km);
  }).map((p) => ({ id: p.id, body: p.body, audience: p.audience, created_at: p.created_at, mine: p.author_id === req.user.id }));
  res.json({ success: true, posts: visible });
});

router.post("/posts", postLimit, async (req, res) => {
  const db = serviceClient();
  if (!(await eligibleKeralaMember(db, req.user.id))) return res.status(403).json({ success: false, message: "NIVORA community is currently for members in Kerala only." });
  if (typeof req.body?.body !== "string") return res.status(400).json({ success: false, message: "Write a post first." });
  const body = clean(req.body.body);
  const audience = req.body?.audience === "radius" ? "radius" : "kerala";
  const radius = Number(req.body?.radius_km ?? 25);
  if (body.length < 1 || body.length > 2000) return res.status(400).json({ success: false, message: "Posts must be 1–2000 characters." });
  if (audience === "radius" && (!Number.isInteger(radius) || radius < 1 || radius > 100)) return res.status(400).json({ success: false, message: "Choose a radius from 1 to 100 km." });
  let loc = null;
  if (audience === "radius") {
    const { data, error } = await db.from("shake_locations").select("latitude,longitude").eq("user_id", req.user.id).eq("enabled", true).maybeSingle();
    if (error || !data) return res.status(409).json({ success: false, message: "Enable location sharing to post to a nearby radius." });
    loc = data;
  }
  const { data, error } = await db.from("anonymous_posts").insert({
    author_id: req.user.id, body, audience, radius_km: audience === "radius" ? radius : null,
    latitude: loc?.latitude ?? null, longitude: loc?.longitude ?? null
  }).select("id,body,audience,created_at").single();
  if (error) return res.status(500).json({ success: false, message: "Your anonymous post could not be published." });
  res.status(201).json({ success: true, post: data });
});

router.post("/posts/:id/block", postLimit, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid post." });
  const db = serviceClient();
  const { data: post, error } = await db.from("anonymous_posts")
    .select("id,author_id,status").eq("id", req.params.id).eq("status", "published").maybeSingle();
  if (error || !post) return res.status(404).json({ success: false, message: "Post not found." });
  if (post.author_id === req.user.id) return res.status(400).json({ success: false, message: "You cannot block yourself." });
  const { error: blockError } = await db.from("blocks").upsert(
    { blocker_id: req.user.id, blocked_id: post.author_id }, { onConflict: "blocker_id,blocked_id" }
  );
  if (blockError) return res.status(500).json({ success: false, message: "This member could not be blocked." });
  const lowId = req.user.id < post.author_id ? req.user.id : post.author_id;
  const highId = req.user.id < post.author_id ? post.author_id : req.user.id;
  await db.from("friendships").delete().eq("user_low", lowId).eq("user_high", highId);
  await db.from("friend_requests").update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("status", "pending").or(`and(sender_id.eq.${req.user.id},recipient_id.eq.${post.author_id}),and(sender_id.eq.${post.author_id},recipient_id.eq.${req.user.id})`);
  const { data: matches } = await db.from("match_history").select("id")
    .in("status", ["proposed", "active"])
    .or(`and(user_one.eq.${req.user.id},user_two.eq.${post.author_id}),and(user_one.eq.${post.author_id},user_two.eq.${req.user.id})`);
  for (const match of (Array.isArray(matches) ? matches : [])) {
    await db.rpc("nivora_end_match", { p_user: req.user.id, p_match: match.id, p_reason: "blocked" });
  }
  await audit(req.user.id, "anonymous_post_author_blocked", "profile", post.author_id, { post_id: post.id });
  res.json({ success: true, message: "Member blocked. Their posts and chats will no longer be shown." });
});

router.post("/posts/:id/report", postLimit, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid post." });
  const reasons = ["harassment", "fake_profile", "scam", "inappropriate_content", "underage", "other"];
  const reason = req.body?.reason || "inappropriate_content";
  const details = req.body?.details;
  if (!reasons.includes(reason)) return res.status(400).json({ success: false, message: "Choose a valid report reason." });
  if (details !== undefined && details !== null && (typeof details !== "string" || details.length > 1000)) {
    return res.status(400).json({ success: false, message: "Details must be at most 1000 characters." });
  }
  const db = serviceClient();
  const { data: post, error: postError } = await db.from("anonymous_posts")
    .select("id,author_id,status").eq("id", req.params.id).eq("status", "published").maybeSingle();
  if (postError || !post) return res.status(404).json({ success: false, message: "Post not found." });
  if (post.author_id === req.user.id) return res.status(400).json({ success: false, message: "You cannot report your own post." });
  const note = "Anonymous post " + post.id + (details ? " — " + clean(details) : "");
  const { data, error } = await db.from("reports").insert({
    reporter_id: req.user.id, reported_id: post.author_id, match_id: null,
    reason, details: note
  }).select("id").single();
  if (error) return res.status(500).json({ success: false, message: "Report could not be submitted." });
  await audit(req.user.id, "anonymous_post_reported", "report", data.id, { post_id: post.id, reason });
  res.status(201).json({ success: true, message: "Report received. Our team will review it." });
});

router.delete("/posts/:id", postLimit, async (req, res) => {
  const { data, error } = await serviceClient().from("anonymous_posts").update({ status: "removed" })
    .eq("id", req.params.id).eq("author_id", req.user.id).eq("status", "published")
    .select("id").maybeSingle();
  if (error || !data) return res.status(404).json({ success: false, message: "Post not found." });
  res.json({ success: true });
});

module.exports = router;
