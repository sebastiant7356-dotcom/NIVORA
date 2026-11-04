"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth, requireStaff } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid, clean } = require("../lib/validation");
const { endLiveMatchesFor } = require("../lib/matches");
const { audit } = require("../lib/audit");

const router = express.Router();
router.use(requireAuth, requireStaff(), createLimiter({ windowMs: 60_000, max: 120, keyFn: byUser }));

// NOTE: no phone number, email or chat text is returned here by default.
const LIST_COLS = "id, full_name, age, district, gender, job_title, bio, looking_for, relationship_intention, " +
  "min_partner_age, max_partner_age, core_values, approval_status, review_reason, reviewed_at, is_active, " +
  "suspended_at, ai_risk_score, ai_flags, ai_checked_at, ai_source, consent_terms_at, consent_privacy_at, consent_version, created_at, updated_at";
const page = (req) => ({
  limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100),
  offset: Math.max(parseInt(req.query.offset, 10) || 0, 0)
});

async function hasOpenReport(db, userId) {
  const { data, error } = await db.from("reports").select("id").eq("reported_id", userId).eq("status", "open").limit(1).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

router.get("/me", (req, res) => res.json({ success: true, role: req.staffRole }));

router.get("/profiles", (req, res) => res.status(410).json({
  success: false, message: "Routine profile review is disabled. Staff should review accounts only through open reports."
}));

router.get("/profiles/:id", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
  const db = serviceClient();
  const { data: staff } = await db.from("staff_roles").select("user_id").eq("user_id", req.params.id).maybeSingle();
  if (staff) return res.status(404).json({ success: false, message: "Customer profile not found." });
  try {
    if (!(await hasOpenReport(db, req.params.id))) return res.status(404).json({ success: false, message: "Only reported accounts can be reviewed." });
  } catch { return res.status(500).json({ success: false, message: "Could not verify report status." }); }
  const [{ data: profile }, { data: history }, { data: reports }] = await Promise.all([
    db.from("profiles").select(LIST_COLS).eq("id", req.params.id).maybeSingle(),
    db.from("moderation_events").select("id, admin_id, decision, reason, created_at").eq("profile_id", req.params.id).order("created_at", { ascending: false }),
    db.from("reports").select("id, reason, status, created_at").eq("reported_id", req.params.id).order("created_at", { ascending: false })
  ]);
  if (!profile) return res.status(404).json({ success: false, message: "Profile not found." });
  if (!(await audit(req.user.id, "viewed_reported_profile", "profile", req.params.id))) return res.status(503).json({ success: false, message: "Audit logging is unavailable; profile preview was not returned." });
  res.json({ success: true, profile, history: history || [], reports: reports || [] });
});

router.post("/profiles/:id/decision", (req, res) => res.status(410).json({
  success: false, message: "Customer profiles are automatically approved. Review reported accounts through the Reports tab."
}));

router.post("/profiles/:id/rerun-ai", (req, res) => res.status(410).json({
  success: false, message: "Routine AI screening is disabled. Review only accounts with open reports."
}));

// ---- Reports and safety actions ----
router.get("/reports", async (req, res) => {
  const status = req.query.status || "open";
  if (!["open", "actioned", "dismissed", "all"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status filter." });
  const { limit, offset } = page(req);
  let q = serviceClient().from("reports").select("id, reporter_id, reported_id, match_id, reason, details, status, resolution, resolved_at, created_at", { count: "exact" })
    .order("created_at", { ascending: true }).range(offset, offset + limit - 1);
  if (status !== "all") q = q.eq("status", status);
  const { data, count, error } = await q;
  if (error) return res.status(500).json({ success: false, message: "Could not load reports." });
  res.json({ success: true, total: count, reports: data || [] });
});

// Reading a reported conversation is a sensitive action: explicit opt-in and always audit-logged.
router.get("/reports/:id/messages", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
  const db = serviceClient();
  const { data: r, error: reportError } = await db.from("reports").select("id, match_id").eq("id", req.params.id).maybeSingle();
  if (reportError) return res.status(500).json({ success: false, message: "Could not load report." });
  if (!r || !r.match_id) return res.status(404).json({ success: false, message: "No conversation attached to this report." });
  const { data, error } = await db.from("messages").select("sender_id, body, created_at").eq("match_id", r.match_id).order("created_at").limit(500);
  if (error) return res.status(500).json({ success: false, message: "Could not load reported conversation." });
  if (!(await audit(req.user.id, "viewed_reported_chat", "report", r.id))) return res.status(503).json({ success: false, message: "Audit logging is unavailable; chat preview was not returned." });
  res.json({ success: true, messages: data || [] });
});

router.post("/reports/:id/resolve", async (req, res) => {
  const { status, resolution, suspend_user } = req.body || {};
  if (!isUuid(req.params.id) || !["actioned", "dismissed"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid request." });
  }
  const note = typeof resolution === "string" ? clean(resolution).slice(0, 500) : "";
  if (note.length < 5) return res.status(400).json({ success: false, message: "A resolution note is required." });
  const db = serviceClient();
  const { data: r, error: lookupError } = await db.from("reports").select("id, reported_id, status").eq("id", req.params.id).maybeSingle();
  if (lookupError) return res.status(500).json({ success: false, message: "Could not load report." });
  if (!r) return res.status(404).json({ success: false, message: "Report not found." });
  if (r.status !== "open") return res.status(409).json({ success: false, message: "This report has already been resolved." });
  if (suspend_user === true) {
    if (req.staffRole !== "admin") return res.status(403).json({ success: false, message: "Only admins can suspend users." });
    if (r.reported_id) {
      try { await suspend(r.reported_id, "Report " + r.id + ": " + note, req.user.id); }
      catch { return res.status(500).json({ success: false, message: "The account could not be suspended; the report remains open." }); }
    }
  }
  const { error: updateError } = await db.from("reports").update({
    status, resolution: note, resolved_by: req.user.id, resolved_at: new Date().toISOString()
  }).eq("id", r.id);
  if (updateError) return res.status(500).json({ success: false, message: "Report resolution could not be saved." });
  await audit(req.user.id, "report_resolved", "report", r.id, { status, suspended: suspend_user === true });
  res.json({ success: true });
});

async function suspend(userId, reason, adminId) {
  const db = serviceClient();
  const { data, error } = await db.from("profiles").update({
    is_active: false, suspended_at: new Date().toISOString(), suspension_reason: reason.slice(0, 500)
  }).eq("id", userId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Profile not found.");
  await endLiveMatchesFor(userId, "suspended", adminId);
  const { error: eventError } = await db.from("moderation_events").insert({
    profile_id: userId, admin_id: adminId, decision: "suspended", reason: reason.slice(0, 500)
  });
  if (eventError) throw eventError;
  await audit(adminId, "user_suspended", "profile", userId);
}

router.post("/users/:id/suspend", requireStaff("admin"), async (req, res) => {
  const note = typeof req.body?.reason === "string" ? clean(req.body.reason) : "";
  if (!isUuid(req.params.id) || note.length < 5) return res.status(400).json({ success: false, message: "A reason (at least 5 characters) is required." });
  if (req.params.id === req.user.id) return res.status(403).json({ success: false, message: "You cannot suspend yourself." });
  try { await suspend(req.params.id, note, req.user.id); }
  catch { return res.status(500).json({ success: false, message: "Account suspension could not be completed." }); }
  res.json({ success: true });
});

router.post("/users/:id/reinstate", requireStaff("admin"), async (req, res) => {
  const note = typeof req.body?.reason === "string" ? clean(req.body.reason) : "";
  if (!isUuid(req.params.id) || note.length < 5) return res.status(400).json({ success: false, message: "A reason (at least 5 characters) is required." });
  const db = serviceClient();
  const { data, error } = await db.from("profiles").update({ is_active: true, suspended_at: null, suspension_reason: null }).eq("id", req.params.id).select("id").maybeSingle();
  if (error) return res.status(500).json({ success: false, message: "Account reinstatement could not be completed." });
  if (!data) return res.status(404).json({ success: false, message: "Profile not found." });
  const { error: eventError } = await db.from("moderation_events").insert({ profile_id: req.params.id, admin_id: req.user.id, decision: "reinstated", reason: note.slice(0, 500) });
  if (eventError) return res.status(500).json({ success: false, message: "Reinstatement history could not be saved." });
  await audit(req.user.id, "user_reinstated", "profile", req.params.id);
  res.json({ success: true });
});

router.get("/moderation-history", async (req, res) => {
  const { limit, offset } = page(req);
  let q = serviceClient().from("moderation_events").select("id, profile_id, admin_id, decision, reason, created_at")
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (req.query.profile_id) {
    if (!isUuid(req.query.profile_id)) return res.status(400).json({ success: false, message: "Invalid id." });
    q = q.eq("profile_id", req.query.profile_id);
  }
  const { data, error } = await q;
  if (error) return res.status(500).json({ success: false, message: "Could not load history." });
  res.json({ success: true, events: data || [] });
});

router.get("/audit", async (req, res) => {
  const { limit, offset } = page(req);
  const { data, error } = await serviceClient().from("audit_log").select("id, actor_id, action, target_type, target_id, details, created_at")
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) return res.status(500).json({ success: false, message: "Could not load audit log." });
  res.json({ success: true, entries: data || [] });
});


const PHOTO_BUCKET = "profile-photos";
// Pending photo review is separate from reported-account investigation.
router.get("/pending-photos", async (req, res) => {
  const db = serviceClient();
  const { data, error } = await db.from("profile_photos")
    .select("id, user_id, object_path, sort_order, approval_status, created_at")
    .eq("approval_status", "pending").order("created_at", { ascending: true }).limit(100);
  if (error) return res.status(500).json({ success: false, message: "Could not load pending photos." });
  try {
    const photos = await Promise.all((data || []).map(async (photo) => {
      const { data: signed, error: signError } = await db.storage.from(PHOTO_BUCKET).createSignedUrl(photo.object_path, 600);
      return signError ? { id: photo.id, user_id: photo.user_id, approval_status: photo.approval_status, error: "preview_unavailable" }
        : { id: photo.id, user_id: photo.user_id, sort_order: photo.sort_order, approval_status: photo.approval_status, created_at: photo.created_at, url: signed.signedUrl };
    }));
    for (const photo of photos) {
      if (!(await audit(req.user.id, "viewed_pending_profile_photo", "profile_photo", photo.id)))
        return res.status(503).json({ success: false, message: "Audit logging is unavailable; photo previews were not returned." });
    }
    res.json({ success: true, photos });
  } catch { res.status(500).json({ success: false, message: "Could not prepare pending photo previews." }); }
});

router.post("/pending-photos/:photoId/decision", async (req, res) => {
  const { decision, reason } = req.body || {};
  if (!isUuid(req.params.photoId) || !["approved", "rejected"].includes(decision))
    return res.status(400).json({ success: false, message: "Invalid photo review request." });
  const note = typeof reason === "string" ? clean(reason).slice(0, 500) : "";
  if (decision === "rejected" && note.length < 5)
    return res.status(400).json({ success: false, message: "A rejection reason (at least 5 characters) is required." });
  const db = serviceClient();
  const { data: photo, error: lookupError } = await db.from("profile_photos")
    .select("id, user_id, approval_status").eq("id", req.params.photoId).eq("approval_status", "pending").maybeSingle();
  if (lookupError) return res.status(500).json({ success: false, message: "Could not load pending photo." });
  if (!photo) return res.status(404).json({ success: false, message: "Pending photo not found." });
  const { error } = await db.from("profile_photos").update({
    approval_status: decision, review_reason: note || null, reviewed_by: req.user.id, reviewed_at: new Date().toISOString()
  }).eq("id", photo.id).eq("approval_status", "pending");
  if (error) return res.status(500).json({ success: false, message: "Photo review could not be saved." });
  await audit(req.user.id, "pending_profile_photo_decision", "profile_photo", photo.id, { decision, from: "pending" });
  res.json({ success: true, approval_status: decision });
});

router.get("/profiles/:id/photos", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
  const db = serviceClient();
  try {
    if (!(await hasOpenReport(db, req.params.id))) return res.status(404).json({ success: false, message: "Only reported accounts can be reviewed." });
  } catch { return res.status(500).json({ success: false, message: "Could not verify report status." }); }
  const { data, error } = await db.from("profile_photos")
    .select("id, object_path, sort_order, approval_status, review_reason, created_at")
    .eq("user_id", req.params.id).order("sort_order");
  if (error) return res.status(500).json({ success: false, message: "Could not load profile photos." });
  const photos = await Promise.all((data || []).map(async (photo) => {
    const { data: signed, error: signError } = await db.storage.from(PHOTO_BUCKET).createSignedUrl(photo.object_path, 600);
    return signError ? { id: photo.id, approval_status: photo.approval_status, error: "preview_unavailable" }
      : { id: photo.id, sort_order: photo.sort_order, approval_status: photo.approval_status,
          review_reason: photo.review_reason, created_at: photo.created_at, url: signed.signedUrl };
  }));
  if (!(await audit(req.user.id, "viewed_profile_photos", "profile", req.params.id))) return res.status(503).json({ success: false, message: "Audit logging is unavailable; photo previews were not returned." });
  res.json({ success: true, photos });
});

router.post("/profiles/:id/photos/:photoId/decision", async (req, res) => {
  const { decision, reason } = req.body || {};
  if (!isUuid(req.params.id) || !isUuid(req.params.photoId) || !["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ success: false, message: "Invalid photo review request." });
  }
  if (req.params.id === req.user.id) return res.status(403).json({ success: false, message: "You cannot review your own photo." });
  const note = typeof reason === "string" ? clean(reason).slice(0, 500) : "";
  if (decision === "rejected" && note.length < 5) return res.status(400).json({ success: false, message: "A rejection reason (at least 5 characters) is required." });
  const db = serviceClient();
  try {
    if (!(await hasOpenReport(db, req.params.id))) return res.status(404).json({ success: false, message: "Only reported accounts can be reviewed." });
  } catch { return res.status(500).json({ success: false, message: "Could not verify report status." }); }
  const { data: photo, error: lookupError } = await db.from("profile_photos")
    .select("id, user_id, approval_status").eq("id", req.params.photoId).eq("user_id", req.params.id).maybeSingle();
  if (lookupError) return res.status(500).json({ success: false, message: "Could not load photo." });
  if (!photo) return res.status(404).json({ success: false, message: "Photo not found." });
  const { error } = await db.from("profile_photos").update({
    approval_status: decision, review_reason: note || null, reviewed_by: req.user.id, reviewed_at: new Date().toISOString()
  }).eq("id", photo.id);
  if (error) return res.status(500).json({ success: false, message: "Photo review could not be saved." });
  await audit(req.user.id, "profile_photo_decision", "profile_photo", photo.id, { decision, from: photo.approval_status });
  res.json({ success: true, approval_status: decision });
});


router.get("/reports/:id/voice", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid report id." });
  const db = serviceClient();
  const { data: report, error: reportError } = await db.from("reports")
    .select("id, match_id").eq("id", req.params.id).maybeSingle();
  if (reportError) return res.status(500).json({ success: false, message: "Could not load report." });
  if (!report || !report.match_id) return res.status(404).json({ success: false, message: "No conversation attached to this report." });
  const { data, error } = await db.from("voice_messages")
    .select("id, sender_id, object_path, duration_seconds, created_at")
    .eq("match_id", report.match_id).order("created_at").limit(100);
  if (error) return res.status(500).json({ success: false, message: "Could not load reported voice messages." });
  try {
    const voiceMessages = await Promise.all((data || []).map(async (v) => {
      const { data: signed, error: signError } = await db.storage.from("voice-messages").createSignedUrl(v.object_path, 600);
      return signError ? null : { id: v.id, sender_id: v.sender_id, duration_seconds: v.duration_seconds, created_at: v.created_at, url: signed.signedUrl };
    }));
    if (!(await audit(req.user.id, "viewed_reported_voice", "report", report.id))) return res.status(503).json({ success: false, message: "Audit logging is unavailable; voice previews were not returned." });
    res.json({ success: true, voice_messages: voiceMessages.filter(Boolean) });
  } catch {
    res.status(500).json({ success: false, message: "Voice previews could not be prepared." });
  }
});

module.exports = router;
