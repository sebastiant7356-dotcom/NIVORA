"use strict";
const express = require("express");
const { serviceClient } = require("../lib/clients");
const { requireAuth, requireStaff } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { isUuid, clean } = require("../lib/validation");
const { reviewProfile } = require("../lib/moderation-ai");
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

router.get("/me", (req, res) => res.json({ success: true, role: req.staffRole }));

router.get("/profiles", async (req, res) => {
  const status = req.query.status || "pending";
  if (!["pending", "approved", "rejected", "changes_requested", "all"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status filter." });
  }
  const { limit, offset } = page(req);
  const db = serviceClient();
  const { data: staffRows, error: staffError } = await db.from("staff_roles").select("user_id");
  if (staffError) return res.status(500).json({ success: false, message: "Could not load staff accounts." });
  const staffIds = (staffRows || []).map((row) => row.user_id);
  let q = db.from("profiles").select(LIST_COLS, { count: "exact" })
    .order("created_at", { ascending: true }).range(offset, offset + limit - 1);
  if (staffIds.length) q = q.not("id", "in", "(" + staffIds.join(",") + ")");
  if (status !== "all") q = q.eq("approval_status", status);
  const { data, count, error } = await q;
  if (error) return res.status(500).json({ success: false, message: "Could not load profiles." });
  res.json({ success: true, total: count, profiles: data || [] });
});

router.get("/profiles/:id", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
  const db = serviceClient();
  const { data: staff } = await db.from("staff_roles").select("user_id").eq("user_id", req.params.id).maybeSingle();
  if (staff) return res.status(404).json({ success: false, message: "Customer profile not found." });
  const [{ data: profile }, { data: history }, { data: reports }] = await Promise.all([
    db.from("profiles").select(LIST_COLS).eq("id", req.params.id).maybeSingle(),
    db.from("moderation_events").select("id, admin_id, decision, reason, created_at").eq("profile_id", req.params.id).order("created_at", { ascending: false }),
    db.from("reports").select("id, reason, status, created_at").eq("reported_id", req.params.id).order("created_at", { ascending: false })
  ]);
  if (!profile) return res.status(404).json({ success: false, message: "Profile not found." });
  res.json({ success: true, profile, history: history || [], reports: reports || [] });
});

router.post("/profiles/:id/decision", async (req, res) => {
  const { decision, reason } = req.body || {};
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
  if (!["approved", "rejected", "changes_requested"].includes(decision)) {
    return res.status(400).json({ success: false, message: "Decision must be approved, rejected or changes_requested." });
  }
  if (req.params.id === req.user.id) {
    return res.status(403).json({ success: false, message: "You cannot review your own profile." });
  }
  const note = typeof reason === "string" ? clean(reason).slice(0, 500) : "";
  if (decision !== "approved" && note.length < 5) {
    return res.status(400).json({ success: false, message: "A reason (at least 5 characters) is required." });
  }
  const db = serviceClient();
  const { data: p } = await db.from("profiles").select("id, approval_status, ai_risk_score, ai_flags, ai_source, suspended_at").eq("id", req.params.id).maybeSingle();
  if (!p) return res.status(404).json({ success: false, message: "Profile not found." });
  if (decision === "approved" && p.suspended_at) {
    return res.status(409).json({ success: false, message: "Reinstate the suspended user first." });
  }
  const now = new Date().toISOString();
  const { error } = await db.from("profiles").update({
    approval_status: decision, reviewed_by: req.user.id, reviewed_at: now, review_reason: note || null
  }).eq("id", req.params.id);
  if (error) return res.status(500).json({ success: false, message: "Decision could not be saved." });
  await db.from("moderation_events").insert({
    profile_id: req.params.id, admin_id: req.user.id, decision, reason: note || null,
    ai_snapshot: { score: p.ai_risk_score, flags: p.ai_flags, source: p.ai_source, advisory: true }
  });
  if (decision !== "approved") await endLiveMatchesFor(req.params.id, "profile_" + decision, req.user.id);
  await audit(req.user.id, "profile_decision", "profile", req.params.id, { decision, from: p.approval_status });
  res.json({ success: true, approval_status: decision });
});

router.post("/profiles/:id/rerun-ai", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
  const db = serviceClient();
  const { data: p } = await db.from("profiles").select("*").eq("id", req.params.id).maybeSingle();
  if (!p) return res.status(404).json({ success: false, message: "Profile not found." });
  const r = await reviewProfile(p);
  await db.from("profiles").update({ ai_risk_score: r.score, ai_flags: r.flags, ai_checked_at: new Date().toISOString(), ai_source: r.source }).eq("id", p.id);
  await audit(req.user.id, "ai_rerun", "profile", p.id);
  res.json({ success: true, ai: { score: r.score, flags: r.flags, source: r.source, advisory: true } });
});

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
  const { data: r } = await db.from("reports").select("id, match_id").eq("id", req.params.id).maybeSingle();
  if (!r || !r.match_id) return res.status(404).json({ success: false, message: "No conversation attached to this report." });
  const { data } = await db.from("messages").select("sender_id, body, created_at").eq("match_id", r.match_id).order("created_at").limit(500);
  await audit(req.user.id, "viewed_reported_chat", "report", r.id);
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
  const { data: r } = await db.from("reports").select("id, reported_id, status").eq("id", req.params.id).maybeSingle();
  if (!r) return res.status(404).json({ success: false, message: "Report not found." });
  if (suspend_user === true) {
    if (req.staffRole !== "admin") return res.status(403).json({ success: false, message: "Only admins can suspend users." });
    if (r.reported_id) await suspend(r.reported_id, `Report ${r.id}: ${note}`, req.user.id);
  }
  await db.from("reports").update({ status, resolution: note, resolved_by: req.user.id, resolved_at: new Date().toISOString() }).eq("id", r.id);
  await audit(req.user.id, "report_resolved", "report", r.id, { status, suspended: suspend_user === true });
  res.json({ success: true });
});

async function suspend(userId, reason, adminId) {
  const db = serviceClient();
  await db.from("profiles").update({ is_active: false, suspended_at: new Date().toISOString(), suspension_reason: reason.slice(0, 500) }).eq("id", userId);
  await endLiveMatchesFor(userId, "suspended", adminId);
  await db.from("moderation_events").insert({ profile_id: userId, admin_id: adminId, decision: "suspended", reason: reason.slice(0, 500) });
  await audit(adminId, "user_suspended", "profile", userId);
}

router.post("/users/:id/suspend", requireStaff("admin"), async (req, res) => {
  const note = typeof req.body?.reason === "string" ? clean(req.body.reason) : "";
  if (!isUuid(req.params.id) || note.length < 5) return res.status(400).json({ success: false, message: "A reason (at least 5 characters) is required." });
  if (req.params.id === req.user.id) return res.status(403).json({ success: false, message: "You cannot suspend yourself." });
  await suspend(req.params.id, note, req.user.id);
  res.json({ success: true });
});

router.post("/users/:id/reinstate", requireStaff("admin"), async (req, res) => {
  const note = typeof req.body?.reason === "string" ? clean(req.body.reason) : "";
  if (!isUuid(req.params.id) || note.length < 5) return res.status(400).json({ success: false, message: "A reason (at least 5 characters) is required." });
  const db = serviceClient();
  await db.from("profiles").update({ is_active: true, suspended_at: null, suspension_reason: null }).eq("id", req.params.id);
  await db.from("moderation_events").insert({ profile_id: req.params.id, admin_id: req.user.id, decision: "reinstated", reason: note.slice(0, 500) });
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
router.get("/profiles/:id/photos", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
  const db = serviceClient();
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
  await audit(req.user.id, "viewed_profile_photos", "profile", req.params.id);
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

module.exports = router;
