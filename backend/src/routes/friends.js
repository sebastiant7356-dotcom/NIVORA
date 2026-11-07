"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid } = require("../lib/validation");

const router = express.Router();
router.use(requireAuth);
const writeLimit = createLimiter({ windowMs: 60 * 60_000, max: 20, keyFn: byUser });

router.get("/", async (req, res) => {
  const db = serviceClient();
  const { data, error } = await db.from("friendships").select("user_low,user_high,created_at")
    .or("user_low.eq." + req.user.id + ",user_high.eq." + req.user.id).order("created_at", { ascending: false }).limit(500);
  if (error) return res.status(500).json({ success: false, message: "Could not load friends." });
  const ids = (data || []).map((row) => row.user_low === req.user.id ? row.user_high : row.user_low);
  if (!ids.length) return res.json({ success: true, friends: [] });
  const { data: profiles, error: profileError } = await db.from("profiles")
    .select("id,full_name,age,district,profile_visibility").in("id", ids);
  if (profileError) return res.status(500).json({ success: false, message: "Could not load friend profiles." });
  const byId = new Map((profiles || []).map((p) => [p.id, p]));
  res.json({ success: true, friends: ids.map((id) => {
    const p = byId.get(id);
    return { display_name: p && p.profile_visibility !== "hidden" ? String(p.full_name || "").trim().split(/\s+/)[0] : "NIVORA friend",
      age: p && p.profile_visibility !== "hidden" ? p.age : null,
      district: p && p.profile_visibility !== "hidden" ? p.district : null,
      created_at: (data || []).find((row) => row.user_low === id || row.user_high === id)?.created_at || null };
  }) });
});

router.get("/requests", async (req, res) => {
  const db = serviceClient();
  const [{ data: incoming, error: inError }, { data: outgoing, error: outError }] = await Promise.all([
    db.from("friend_requests").select("id,sender_id,created_at").eq("recipient_id", req.user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(100),
    db.from("friend_requests").select("id,recipient_id,created_at").eq("sender_id", req.user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(100)
  ]);
  if (inError || outError) return res.status(500).json({ success: false, message: "Could not load friend requests." });
  res.json({ success: true, incoming: incoming || [], outgoing: outgoing || [] });
});

router.post("/request", writeLimit, async (req, res) => {
  if (!isUuid(req.body?.match_id)) return res.status(400).json({ success: false, message: "A valid chat is required." });
  const { data, error } = await serviceClient().rpc("nivora_send_friend_request", {
    p_user: req.user.id, p_match: req.body.match_id
  });
  if (error) {
    const map = { match_not_found: [404, "Chat not found."], blocked: [403, "This connection is unavailable."] };
    const item = map[String(error.message || "").trim()];
    if (item) return res.status(item[0]).json({ success: false, message: item[1] });
    return res.status(500).json({ success: false, message: "Friend request could not be sent." });
  }
  res.json({ success: true, ...data });
});

router.post("/requests/:id/respond", writeLimit, async (req, res) => {
  if (!isUuid(req.params.id) || typeof req.body?.accept !== "boolean") return res.status(400).json({ success: false, message: "Invalid friend request response." });
  const { data, error } = await serviceClient().rpc("nivora_respond_friend_request", {
    p_user: req.user.id, p_request: req.params.id, p_accept: req.body.accept
  });
  if (error) {
    if (String(error.message || "").trim() === "request_not_found") return res.status(404).json({ success: false, message: "Friend request not found." });
    return res.status(500).json({ success: false, message: "Friend request could not be updated." });
  }
  res.json({ success: true, ...data });
});

module.exports = router;
