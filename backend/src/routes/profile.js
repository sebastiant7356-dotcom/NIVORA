"use strict";
const express = require("express");
const config = require("../config");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const { parseProfileInput } = require("../lib/validation");
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


router.get("/", async (req, res) => {
  const { data, error } = await serviceClient().from("profiles").select(OWN_COLUMNS).eq("id", req.user.id).maybeSingle();
  if (error) {
  console.error("PROFILE_LOAD_ERROR:", error);
  return res.status(500).json({
    success: false,
    message: "Could not load profile.",
    code: error.code,
    details: error.message
  });
}
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
    approval_status: "approved",     // server-controlled: customer profiles activate automatically
    consent_terms_at: now,
    consent_privacy_at: now,
    consent_version: config.policyVersion
  };
  const { data, error } = await db.from("profiles").insert(row).select(OWN_COLUMNS).single();
  if (error) {
    if (error.code === "23505") return res.status(409).json({ success: false, code: "profile_exists", message: "A profile already exists for this account." });
    return res.status(500).json({ success: false, message: "Profile could not be saved." });
  }
  await audit(req.user.id, "profile_created", "profile", req.user.id);
  res.status(201).json({ success: true, message: "Profile saved and activated.", profile: present(data) });
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

  const updates = {
    ...parsed.value,
    approval_status: "approved",
    reviewed_by: null,
    reviewed_at: null,
    review_reason: null
  };

  const { data, error } = await db.from("profiles").update(updates).eq("id", req.user.id).select(OWN_COLUMNS).maybeSingle();
  if (error || !data) return res.status(500).json({ success: false, message: "Profile update failed." });
  await storeAiReview(req.user.id, data).catch(() => {});
  await audit(req.user.id, "profile_updated", "profile", req.user.id, { fields: Object.keys(parsed.value) });
  res.json({
    success: true,
    message: "Profile updated and remains active.",
    profile: present(data)
  });
});

module.exports = router;
