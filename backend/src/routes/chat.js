"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid, clean } = require("../lib/validation");
const { assertLiveMatch } = require("../lib/matches");

const router = express.Router();
router.use(requireAuth);
const sendLimit = createLimiter({ windowMs: 60_000, max: 40, keyFn: byUser });

router.get("/:matchId/messages", async (req, res) => {
  if (!isUuid(req.params.matchId)) return res.status(400).json({ success: false, message: "Invalid match." });
  const gate = await assertLiveMatch(req.params.matchId, req.user.id);
  if (gate.status) return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  let q = serviceClient().from("messages").select("id, sender_id, body, created_at")
    .eq("match_id", req.params.matchId).order("created_at", { ascending: true }).limit(limit);
  if (req.query.after && !Number.isNaN(Date.parse(req.query.after))) q = q.gt("created_at", new Date(req.query.after).toISOString());
  const { data, error } = await q;
  if (error) return res.status(500).json({ success: false, message: "Could not load messages." });
  res.json({
    success: true,
    expires_at: gate.match.expires_at,
    messages: (data || []).map((m) => ({ id: m.id, mine: m.sender_id === req.user.id, body: m.body, created_at: m.created_at }))
  });
});

router.post("/:matchId/messages", sendLimit, async (req, res) => {
  if (!isUuid(req.params.matchId) || typeof req.body?.body !== "string") {
    return res.status(400).json({ success: false, message: "Invalid message." });
  }
  const body = clean(req.body.body);
  if (body.length < 1 || body.length > 2000) return res.status(400).json({ success: false, message: "Message must be 1–2000 characters." });
  const gate = await assertLiveMatch(req.params.matchId, req.user.id);
  if (gate.status) return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });
  const { data, error } = await serviceClient().from("messages")
    .insert({ match_id: req.params.matchId, sender_id: req.user.id, body })
    .select("id, body, created_at").single();
  if (error) return res.status(500).json({ success: false, message: "Message could not be sent." });
  res.status(201).json({ success: true, message: { id: data.id, mine: true, body: data.body, created_at: data.created_at } });
});

module.exports = router;
