"use strict";
const express = require("express");
const config = require("../config");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { parseProfileInput, needsReview } = require("../lib/validation");
const { reviewProfile } = require("../lib/moderation-ai");
const { audit } = require("../lib/audit");

const router = express.Router();
router.use(requireAuth);

// Columns a user may see about THEIR OWN profile. AI scores/flags are staff-only.
const OWN_COLUMNS = "id, full_name, age, district, gender, job_title, bio, looking_for, relationship_intention, " +
  "min_partner_age, max_partner_age, core_values, approval_status, review_reason, is_active, suspended_at, " +
  "consent_terms_at, consent_privacy_at, consent_version, created_at, updated_at";

const writeLimit = createLimiter({ windowMs: 60 * 60_000, max: 30, keyFn: byUser });

function isComplete(p) {
  return Boolean(p.gender && p.looking_for && p.relationship_intention && p.core_values?.length && p.district);
}
function present(p) {
  if (!p) return null;
  const { suspended_at, ...rest } = p;
  return { ...rest, suspended: Boolean(suspended_at), profile_complete: isComplete(p) };
}

async function storeAiReview(id, profile) {
  const r = await reviewProfile(profile);
  await serviceClient().from("profiles").update({
    ai_risk_score: r.score, ai_flags: r.flags, ai_checked_at: new Date().toISOString(), ai_source: r.source
  }).eq("id", id);
}

router.get("/", async (req, res) => {
  const { data, error } = await serviceClient().from("profiles").select(OWN_COLUMNS).eq("id", req.user.id).maybeSingle();
  if (error) return res.status(500).json({ success: false, message: "Could not load profile." });
  res.json({ success: true, profile: present(data) });
});

router.post("/", writeLimit, async (req, res) => {
  const parsed = parseProfileInput(req.body, { create: true });
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
  const db = serviceClient();

  const { data: existing, error: lookupErr } = await db.from("profiles").select("id").eq("id", req.user.id).maybeSingle();
  if (lookupErr) return res.status(500).json({ success: false, message: "Could not check existing profile." });
  if (existing) {
    return res.status(409).json({ success: false, code: "profile_exists", message: "A profile already exists for this account. Edit it instead." });
  }

  const now = new Date().toISOString();
  const row = {
    ...parsed.value,
    id: req.user.id,                 // always the verified token's user id
    approval_status: "pending",      // never client-controlled
    consent_terms_at: now,
    consent_privacy_at: now,
    consent_version: config.policyVersion
  };
  const { data, error } = await db.from("profiles").insert(row).select(OWN_COLUMNS).single();
  if (error) {
    if (error.code === "23505") return res.status(409).json({ success: false, code: "profile_exists", message: "A profile already exists for this account." });
    return res.status(500).json({ success: false, message: "Profile could not be saved." });
  }
  await storeAiReview(req.user.id, data).catch(() => {});
  await audit(req.user.id, "profile_created", "profile", req.user.id);
  res.status(201).json({ success: true, message: "Profile saved. It is awaiting staff approval.", profile: present(data) });
});

router.put("/", writeLimit, async (req, res) => {
  const parsed = parseProfileInput(req.body, { create: false });
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
  const db = serviceClient();

  const { data: current, error: curErr } = await db.from("profiles").select("approval_status").eq("id", req.user.id).maybeSingle();
  if (curErr) return res.status(500).json({ success: false, message: "Could not load profile." });
  if (!current) return res.status(404).json({ success: false, message: "Profile not found. Create it first." });
  if (current.approval_status === "rejected") {
    return res.status(403).json({ success: false, message: "This profile was rejected and cannot be edited. Please contact support." });
  }

  const updates = { ...parsed.value };
  const resubmit = needsReview(updates) && ["approved", "changes_requested"].includes(current.approval_status);
  if (current.approval_status === "changes_requested") updates.approval_status = "pending";
  if (resubmit) { updates.approval_status = "pending"; updates.reviewed_by = null; updates.reviewed_at = null; }

  const { data, error } = await db.from("profiles").update(updates).eq("id", req.user.id).select(OWN_COLUMNS).maybeSingle();
  if (error || !data) return res.status(500).json({ success: false, message: "Profile update failed." });
  if (updates.approval_status === "pending") await storeAiReview(req.user.id, data).catch(() => {});
  await audit(req.user.id, "profile_updated", "profile", req.user.id, { fields: Object.keys(parsed.value) });
  res.json({
    success: true,
    message: updates.approval_status === "pending" ? "Profile updated and sent for staff review." : "Profile updated.",
    profile: present(data)
  });
});

module.exports = router;
