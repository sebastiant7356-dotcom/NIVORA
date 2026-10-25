"use strict";
const express = require("express");
const config = require("../config");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid } = require("../lib/validation");
const { assertLiveMatch } = require("../lib/matches");

const router = express.Router();
router.use(requireAuth);
const signalLimit = createLimiter({ windowMs: 60_000, max: 150, keyFn: byUser });

function iceServers() {
  if (config.iceServersJson) {
    try { const v = JSON.parse(config.iceServersJson); if (Array.isArray(v)) return v; } catch { /* fall through */ }
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

// ICE/TURN credentials are only handed to members of a live match.
router.get("/:matchId/ice", async (req, res) => {
  if (!isUuid(req.params.matchId)) return res.status(400).json({ success: false, message: "Invalid match." });
  const gate = await assertLiveMatch(req.params.matchId, req.user.id);
  if (gate.status) return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });
  res.json({ success: true, ice_servers: iceServers(), turn_configured: iceServers().some((s) => String(s.urls).startsWith("turn")) });
});

router.post("/:matchId/signal", signalLimit, async (req, res) => {
  const { kind, payload } = req.body || {};
  if (!isUuid(req.params.matchId) || !["offer", "answer", "ice", "hangup"].includes(kind)) {
    return res.status(400).json({ success: false, message: "Invalid signal." });
  }
  const p = payload && typeof payload === "object" ? payload : {};
  if (JSON.stringify(p).length > 12_000) return res.status(413).json({ success: false, message: "Signal too large." });
  const gate = await assertLiveMatch(req.params.matchId, req.user.id);
  if (gate.status) return res.status(gate.status).json({ success: false, code: gate.code, message: gate.message });
  const { error } = await serviceClient().from("call_signals").insert({
    match_id: req.params.matchId, from_user: req.user.id, to_user: gate.partnerId, kind, payload: p
  });
  if (error) return res.status(500).json({ success: false, message: "Signal could not be sent." });
  res.status(201).json({ success: true });
});

module.exports = router;
