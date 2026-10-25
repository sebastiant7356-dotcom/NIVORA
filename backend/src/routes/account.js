"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { endLiveMatchesFor } = require("../lib/matches");
const { audit } = require("../lib/audit");

const router = express.Router();
router.use(requireAuth);
const limit = createLimiter({ windowMs: 60 * 60_000, max: 5, keyFn: byUser });

// Personal-data export (copy of what we hold about the signed-in user).
router.get("/export", limit, async (req, res) => {
  const db = serviceClient(); const id = req.user.id;
  const [profile, matches, feedback, sent, payments] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.from("match_history").select("id, status, started_at, expires_at, created_at, ended_reason").or(`user_one.eq.${id},user_two.eq.${id}`),
    db.from("match_feedback").select("match_id, wants_to_continue, feedback_text, created_at").eq("reviewer_id", id),
    db.from("messages").select("match_id, body, created_at").eq("sender_id", id),
    db.from("payments").select("status, amount_paise, currency, created_at, paid_at").eq("user_id", id)
  ]);
  if (profile.data) { delete profile.data.ai_flags; delete profile.data.ai_risk_score; }
  await audit(id, "data_export", "account", id);
  res.json({ success: true, exported_at: new Date().toISOString(), profile: profile.data, matches: matches.data || [],
             feedback: feedback.data || [], messages_sent: sent.data || [], payments: payments.data || [] });
});

// Irreversible deletion. Requires an explicit confirmation word.
router.delete("/", limit, async (req, res) => {
  if (req.body?.confirm !== "DELETE") {
    return res.status(400).json({ success: false, message: 'Send {"confirm":"DELETE"} to permanently delete your account.' });
  }
  const db = serviceClient(); const id = req.user.id;
  try {
    await endLiveMatchesFor(id, "account_deleted", id);
    // Deleting matches cascades to messages, call signals and feedback for those matches.
    await db.from("match_history").delete().or(`user_one.eq.${id},user_two.eq.${id}`);
    await db.from("match_feedback").delete().eq("reviewer_id", id);
    await db.from("match_members").delete().eq("user_id", id);
    // Payment records are kept for accounting but detached from the person.
    await db.from("payments").update({ user_id: null }).eq("user_id", id);
    await audit(id, "account_deleted", "account", id);
    const { error } = await db.auth.admin.deleteUser(id); // cascades profile, blocks, staff role, moderation events
    if (error) throw error;
    res.json({ success: true, message: "Your account and personal data have been deleted." });
  } catch {
    res.status(500).json({ success: false, message: "Deletion could not be completed. Please try again or contact support." });
  }
});

module.exports = router;
