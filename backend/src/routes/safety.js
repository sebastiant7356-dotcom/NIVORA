"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid, clean } = require("../lib/validation");
const { getMatchFor, endLiveMatchesFor } = require("../lib/matches");
const { audit } = require("../lib/audit");

const router = express.Router();
router.use(requireAuth);
const REASONS = ["harassment", "fake_profile", "scam", "inappropriate_content", "underage", "other"];
const reportLimit = createLimiter({ windowMs: 24 * 60 * 60_000, max: 10, keyFn: byUser });
const blockLimit = createLimiter({ windowMs: 60 * 60_000, max: 20, keyFn: byUser });

async function partnerOf(matchId, userId) {
  if (!isUuid(matchId)) return null;
  const m = await getMatchFor(matchId, userId);
  if (!m) return null;
  return { match: m, partnerId: m.user_one === userId ? m.user_two : m.user_one };
}

router.post("/block", blockLimit, async (req, res) => {
  const ctx = await partnerOf(req.body?.match_id, req.user.id);
  if (!ctx) return res.status(404).json({ success: false, message: "Match not found." });
  const { error } = await serviceClient().from("blocks")
    .upsert({ blocker_id: req.user.id, blocked_id: ctx.partnerId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error) return res.status(500).json({ success: false, message: "Could not block this person." });
  // Close any live match with that person immediately (chat/voice stop with it).
  if (["proposed", "active"].includes(ctx.match.status)) {
    await serviceClient().rpc("nivora_end_match", { p_user: req.user.id, p_match: ctx.match.id, p_reason: "blocked" });
  }
  await audit(req.user.id, "user_blocked", "match", ctx.match.id);
  res.json({ success: true, message: "Blocked. You will not be matched again and the conversation is closed." });
});

router.post("/report", reportLimit, async (req, res) => {
  const { match_id, reason, details } = req.body || {};
  const ctx = await partnerOf(match_id, req.user.id);
  if (!ctx) return res.status(404).json({ success: false, message: "Match not found." });
  if (!REASONS.includes(reason)) return res.status(400).json({ success: false, message: "Choose a valid reason." });
  if (details !== undefined && details !== null && (typeof details !== "string" || details.length > 1000)) {
    return res.status(400).json({ success: false, message: "Details must be at most 1000 characters." });
  }
  const { data, error } = await serviceClient().from("reports").insert({
    reporter_id: req.user.id, reported_id: ctx.partnerId, match_id: ctx.match.id,
    reason, details: details ? clean(details) : null
  }).select("id").single();
  if (error) return res.status(500).json({ success: false, message: "Report could not be submitted." });
  await audit(req.user.id, "report_filed", "report", data.id, { reason });
  res.status(201).json({ success: true, message: "Report received. Our team will review it." });
});

module.exports = router;
