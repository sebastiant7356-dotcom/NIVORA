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
  const [profile, matches, feedback, payments, photos] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.from("match_history").select("id, status, started_at, expires_at, created_at, ended_reason").or("user_one.eq." + id + ",user_two.eq." + id),
    db.from("match_feedback").select("match_id, wants_to_continue, feedback_text, created_at").eq("reviewer_id", id),
    db.from("payments").select("status, amount_paise, currency, created_at, paid_at").eq("user_id", id),
    db.from("profile_photos").select("id, object_path, approval_status, mime_type, size_bytes, sort_order, created_at").eq("user_id", id)
  ]);
  const initial = [profile, matches, feedback, payments, photos];
  if (initial.some((r) => r.error)) return res.status(500).json({ success: false, message: "Your data export could not be prepared." });
  if (profile.data) { delete profile.data.ai_flags; delete profile.data.ai_risk_score; }
  const matchIds = (matches.data || []).map((m) => m.id);
  let messages = [], voiceRows = [];
  if (matchIds.length) {
    const [messageResult, voiceResult] = await Promise.all([
      db.from("messages").select("id, match_id, sender_id, body, created_at").in("match_id", matchIds).order("created_at"),
      db.from("voice_messages").select("id, match_id, sender_id, mime_type, size_bytes, duration_seconds, object_path, created_at").in("match_id", matchIds).order("created_at")
    ]);
    if (messageResult.error || voiceResult.error) return res.status(500).json({ success: false, message: "Your conversation export could not be prepared." });
    messages = messageResult.data || [];
    voiceRows = voiceResult.data || [];
  }
  const [photoExports, voiceExports] = await Promise.all([
    Promise.all((photos.data || []).map(async (p) => {
      const { data, error } = await db.storage.from("profile-photos").createSignedUrl(p.object_path, 600);
      return { id: p.id, approval_status: p.approval_status, mime_type: p.mime_type, size_bytes: p.size_bytes,
        sort_order: p.sort_order, created_at: p.created_at, url: error ? null : data.signedUrl };
    })),
    Promise.all(voiceRows.map(async (v) => {
      const { data, error } = await db.storage.from("voice-messages").createSignedUrl(v.object_path, 3600);
      return { id: v.id, match_id: v.match_id, sender_id: v.sender_id, mime_type: v.mime_type, size_bytes: v.size_bytes,
        duration_seconds: v.duration_seconds, created_at: v.created_at, url: error ? null : data.signedUrl };
    }))
  ]);
  await audit(id, "data_export", "account", id);
  res.json({
    success: true, exported_at: new Date().toISOString(), profile: profile.data,
    matches: matches.data || [], feedback: feedback.data || [], messages,
    payments: payments.data || [], photos: photoExports, voice_messages: voiceExports
  });
});

// Irreversible deletion. Requires an explicit confirmation word.
router.delete("/", limit, async (req, res) => {
  const { data: staff, error: staffError } = await serviceClient().from("staff_roles").select("user_id").eq("user_id", req.user.id).maybeSingle();
  if (staffError) return res.status(500).json({ success: false, message: "Could not verify account type." });
  if (staff) return res.status(403).json({ success: false, message: "Staff accounts must be managed by an administrator." });
  if (req.body?.confirm !== "DELETE") {
    return res.status(400).json({ success: false, message: 'Send {"confirm":"DELETE"} to permanently delete your account.' });
  }
  const db = serviceClient(); const id = req.user.id;
  let retentionCancellationAt = null;
  try {
    const { data: authResult, error: authLookupError } = await db.auth.admin.getUserById(id);
    if (authLookupError || !authResult?.user) throw authLookupError || new Error("Account registration record unavailable.");
    const authUser = authResult.user;
    const registrationRecord = {
      auth_user_id: id,
      registration_email: authUser.email || null,
      registration_display_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
      registration_provider: authUser.app_metadata?.provider || "google",
      registered_at: authUser.created_at || null
    };
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
    const { error: feedbackDeleteError } = await db.from("match_feedback").delete().eq("reviewer_id", id);
    if (feedbackDeleteError) throw feedbackDeleteError;
    const { error: memberDeleteError } = await db.from("match_members").delete().eq("user_id", id);
    if (memberDeleteError) throw memberDeleteError;
    // Payment records are kept for accounting but detached from the person.
    const { error: paymentDetachError } = await db.from("payments").update({ user_id: null }).eq("user_id", id);
    if (paymentDetachError) throw paymentDetachError;
    const auditOk = await audit(id, "account_deleted", "account", id);
    if (!auditOk) throw new Error("Account deletion audit could not be recorded.");

    // IT Intermediary Rules require registration information to be retained for
    // 180 days after cancellation. Keep only Google registration identifiers,
    // not the profile, photos, conversations or voice content being deleted.
    const cancellationDate = new Date();
    retentionCancellationAt = cancellationDate.toISOString();
    const purgeAfter = new Date(cancellationDate.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
    const { error: retentionError } = await db.from("account_deletion_retention").upsert({
      ...registrationRecord,
      cancelled_at: retentionCancellationAt,
      purge_after: purgeAfter
    }, { onConflict: "auth_user_id" });
    if (retentionError) throw retentionError;

    const { error } = await db.auth.admin.deleteUser(id); // cascades profile, blocks, staff role, moderation events
    if (error) {
      await db.from("account_deletion_retention").delete()
        .eq("auth_user_id", id).eq("cancelled_at", retentionCancellationAt);
      throw error;
    }
    res.json({ success: true, message: "Your account has been deleted. Limited registration details are retained for 180 days as required by applicable law; certain safety records may also be retained." });
  } catch {
    res.status(500).json({ success: false, message: "Deletion could not be completed. Please try again or contact support." });
  }
});

module.exports = router;
