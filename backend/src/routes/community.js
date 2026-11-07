"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { clean } = require("../lib/validation");

const router = express.Router();
router.use(requireAuth);
const postLimit = createLimiter({ windowMs: 60 * 60_000, max: 10, keyFn: byUser });

function distanceKm(aLat, aLon, bLat, bLon) {
  const rad = (n) => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

router.get("/feed", async (req, res) => {
  const db = serviceClient();
  const { data: rows, error } = await db.from("anonymous_posts")
    .select("id,author_id,body,audience,radius_km,latitude,longitude,created_at")
    .eq("status", "published").order("created_at", { ascending: false }).limit(100);
  if (error) return res.status(500).json({ success: false, message: "Could not load the community feed." });
  const radiusRows = (rows || []).filter((p) => p.audience === "radius");
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
    if (p.audience === "kerala") return true;
    const loc = locById.get(p.author_id);
    return Boolean(mine && loc && distanceKm(mine.latitude, mine.longitude, loc.latitude, loc.longitude) <= p.radius_km);
  }).map((p) => ({ id: p.id, body: p.body, audience: p.audience, created_at: p.created_at, mine: p.author_id === req.user.id }));
  res.json({ success: true, posts: visible });
});

router.post("/posts", postLimit, async (req, res) => {
  if (typeof req.body?.body !== "string") return res.status(400).json({ success: false, message: "Write a post first." });
  const body = clean(req.body.body);
  const audience = req.body?.audience === "radius" ? "radius" : "kerala";
  const radius = Number(req.body?.radius_km ?? 25);
  if (body.length < 1 || body.length > 2000) return res.status(400).json({ success: false, message: "Posts must be 1–2000 characters." });
  if (audience === "radius" && (!Number.isInteger(radius) || radius < 1 || radius > 100)) return res.status(400).json({ success: false, message: "Choose a radius from 1 to 100 km." });
  const db = serviceClient();
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

router.delete("/posts/:id", postLimit, async (req, res) => {
  const { data, error } = await serviceClient().from("anonymous_posts").update({ status: "removed" })
    .eq("id", req.params.id).eq("author_id", req.user.id).eq("status", "published")
    .select("id").maybeSingle();
  if (error || !data) return res.status(404).json({ success: false, message: "Post not found." });
  res.json({ success: true });
});

module.exports = router;
