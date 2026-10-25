"use strict";
const express = require("express");
const config = require("../config");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid } = require("../lib/validation");
const { rpcError, expire, getMatchFor, matchView } = require("../lib/matches");
const { audit } = require("../lib/audit");

const router = express.Router();
router.use(requireAuth);
const findLimit = createLimiter({ windowMs: 60 * 60_000, max: 10, keyFn: byUser });

router.get("/current", async (req, res) => {
  await expire();
  const db = serviceClient();
  const { data: member } = await db.from("match_members").select("match_id").eq("user_id", req.user.id).maybeSingle();
  if (!member) return res.json({ success: true, match: null });
  const match = await getMatchFor(member.match_id, req.user.id);
  res.json({ success: true, match: match ? await matchView(match, req.user.id) : null });
});

router.post("/find", findLimit, async (req, res) => {
  const { data, error } = await serviceClient().rpc("nivora_find_partner", {
    p_user: req.user.id,
    p_require_payment: config.payment.required
  });
  if (error) return rpcError(res, error);
  if (!data?.found) return res.json({ success: true, found: false, message: "No suitable profile is available right now. Please check again later." });
  const match = await getMatchFor(data.match_id, req.user.id);
  await audit(req.user.id, "match_proposed", "match", data.match_id);
  res.json({ success: true, found: true, match: await matchView(match, req.user.id) });
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
