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
  const [profile, matches, feedback, sent, payments, photos] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.from("match_history").select("id, status, started_at, expires_at, created_at, ended_reason").or(`user_one.eq.${id},user_two.eq.${id}`),
    db.from("match_feedback").select("match_id, wants_to_continue, feedback_text, created_at").eq("reviewer_id", id),
    db.from("messages").select("match_id, body, created_at").eq("sender_id", id),
    db.from("payments").select("status, amount_paise, currency, created_at, paid_at").eq("user_id", id),
    db.from("profile_photos").select("approval_status, mime_type, size_bytes, sort_order, created_at").eq("user_id", id)
  ]);
  if (profile.data) { delete profile.data.ai_flags; delete profile.data.ai_risk_score; }
  await audit(id, "data_export", "account", id);
  res.json({ success: true, exported_at: new Date().toISOString(), profile: profile.data, matches: matches.data || [],
             feedback: feedback.data || [], messages_sent: sent.data || [], payments: payments.data || [], photos: photos.data || [] });
});

// Irreversible deletion. Requires an explicit confirmation word.
router.delete("/", limit, async (req, res) => {
  if (req.body?.confirm !== "DELETE") {
    return res.status(400).json({ success: false, message: 'Send {"confirm":"DELETE"} to permanently delete your account.' });
  }
  const db = serviceClient(); const id = req.user.id;
  try {
    await endLiveMatchesFor(id, "account_deleted", id);
    // Storage objects do not cascade with database rows.
    const { data: photoRows, error: photoLookupError } = await db.from("profile_photos").select("object_path").eq("user_id", id);
    if (photoLookupError) throw photoLookupError;
    const photoPaths = (photoRows || []).map((p) => p.object_path);
    if (photoPaths.length) {
      const { error: photoDeleteError } = await db.storage.from("profile-photos").remove(photoPaths);
      if (photoDeleteError) throw photoDeleteError;
    }
    // Voice files are private Storage objects; remove them before their match rows cascade.
    const { data: userMatches, error: matchLookupError } = await db.from("match_history").select("id").or(`user_one.eq.${id},user_two.eq.${id}`);
    if (matchLookupError) throw matchLookupError;
    const matchIds = (userMatches || []).map((m) => m.id);
    if (matchIds.length) {
      const { data: voiceRows, error: voiceLookupError } = await db.from("voice_messages").select("object_path").in("match_id", matchIds);
      if (voiceLookupError) throw voiceLookupError;
      const voicePaths = (voiceRows || []).map((v) => v.object_path);
      if (voicePaths.length) {
        const { error: voiceDeleteError } = await db.storage.from("voice-messages").remove(voicePaths);
        if (voiceDeleteError) throw voiceDeleteError;
      }
      // Deleting matches cascades to text/voice messages, call signals and feedback.
      const { error: matchDeleteError } = await db.from("match_history").delete().in("id", matchIds);
      if (matchDeleteError) throw matchDeleteError;
    }
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
