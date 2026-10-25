"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { isUuid, clean } = require("../lib/validation");
const { getMatchFor, expire } = require("../lib/matches");

const router = express.Router();
router.use(requireAuth);

router.post("/", async (req, res) => {
  const { match_id, wants_to_continue, feedback_text } = req.body || {};
  if (!isUuid(match_id) || typeof wants_to_continue !== "boolean" ||
      (feedback_text != null && (typeof feedback_text !== "string" || feedback_text.length > 1000))) {
    return res.status(400).json({ success: false, message: "Invalid feedback details." });
  }
  await expire();
  const match = await getMatchFor(match_id, req.user.id);
  // Feedback only makes sense for matches that actually started.
  if (!match || !match.started_at) return res.status(403).json({ success: false, message: "You cannot submit feedback for this match." });

  const { data, error } = await serviceClient().from("match_feedback").insert({
    match_id, reviewer_id: req.user.id, wants_to_continue,
    feedback_text: feedback_text ? clean(feedback_text) : null
  }).select("id, match_id, wants_to_continue, created_at").single();
  if (error) {
    if (error.code === "23505") return res.status(409).json({ success: false, message: "Feedback already submitted for this match." });
    return res.status(500).json({ success: false, message: "Could not submit feedback." });
  }
  res.status(201).json({ success: true, feedback: data });
});

module.exports = router;
