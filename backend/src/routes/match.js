"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { isUuid } = require("../lib/validation");
const { rpcError, expire, getMatchFor, matchView } = require("../lib/matches");

const router = express.Router();
router.use(requireAuth);

router.get("/current", async (req, res) => {
  await expire();
  const db = serviceClient();
  const { data: members, error: memberError } = await db.from("match_members").select("match_id").eq("user_id", req.user.id);
  if (memberError) return res.status(500).json({ success: false, message: "Could not load your conversations." });
  const matches = [];
  for (const member of members || []) {
    const row = await getMatchFor(member.match_id, req.user.id);
    if (row && ["proposed", "active"].includes(row.status)) matches.push(await matchView(row, req.user.id));
  }
  matches.sort((a, b) => String(b.started_at || b.proposal_expires_at || "").localeCompare(String(a.started_at || a.proposal_expires_at || "")));
  res.json({ success: true, matches, match: matches[0] || null });
});

router.post("/find", async (_req, res) => {
  res.status(410).json({ success: false, code: "daily_matching_disabled", message: "Daily matchmaking has been retired. Use Shake & Chat instead." });
});

router.post("/:id/respond", async (req, res) => {
  if (!isUuid(req.params.id) || typeof req.body?.accept !== "boolean") {
    return res.status(400).json({ success: false, message: "Invalid request." });
  }
  const { data, error } = await serviceClient().rpc("nivora_respond_match", {
    p_user: req.user.id, p_match: req.params.id, p_accept: req.body.accept
  });
  if (error) return rpcError(res, error);
  const match = await getMatchFor(req.params.id, req.user.id);
  res.json({ success: true, status: data.status, match: match ? await matchView(match, req.user.id) : null });
});

router.post("/:id/end", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid request." });
  const { data, error } = await serviceClient().rpc("nivora_end_match", {
    p_user: req.user.id, p_match: req.params.id, p_reason: "ended_by_user"
  });
  if (error) return rpcError(res, error);
  res.json({ success: true, status: data.status });
});

router.get("/history", async (req, res) => {
  await expire();
  const { data, error } = await serviceClient().from("match_history")
    .select("id, status, started_at, expires_at, created_at, ended_reason")
    .or(`user_one.eq.${req.user.id},user_two.eq.${req.user.id}`)
    .order("created_at", { ascending: false }).limit(100);
  if (error) return res.status(500).json({ success: false, message: "Could not load match history." });
  res.json({ success: true, history: data || [] });
});

module.exports = router;
