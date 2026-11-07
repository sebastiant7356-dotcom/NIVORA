"use strict";
const express = require("express");
const { requireAuth, requireStaff } = require("../middleware");
const { serviceClient } = require("../lib/clients");
const { clean } = require("../lib/validation");

const router = express.Router();
router.use(requireAuth);
const REASONS = ["harassment", "fake_profile", "scam", "inappropriate_content", "underage", "other"];
const audit = async (actorId, action, targetId, details = {}) => {
  const { error } = await serviceClient().from("audit_log").insert({
    actor_id: actorId, action, target_type: "user", target_id: targetId, details
  });
  if (error) throw error;
};
let lastPurge = 0;
async function purgeExpiredReports() {
  if (Date.now() - lastPurge < 60 * 60 * 1000) return;
  const { error } = await serviceClient().from("reports").delete().lt("created_at", new Date(Date.now() - 90 * 86400000).toISOString());
  if (error) throw error;
  const { error: auditError } = await serviceClient().from("audit_log").delete()
    .lt("created_at", new Date(Date.now() - 365 * 86400000).toISOString());
  if (auditError) throw auditError;
  lastPurge = Date.now();
}
async function persistReport({ reporterId, reportedId, reason, details = "" }) {
  if (!reporterId || !reportedId || reporterId === reportedId || !REASONS.includes(reason)) {
    const e = new Error("Invalid report."); e.status = 400; throw e;
  }
  await purgeExpiredReports();
  const { data, error } = await serviceClient().from("reports").insert({
    reporter_id: reporterId, reported_id: reportedId, match_id: null,
    reason, details: clean(details).slice(0, 500), status: "open"
  }).select("id,created_at").single();
  if (error) throw error;
  return data;
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/admin/me", requireStaff(), (req, res) => res.json({ success: true, role: req.staffRole }));
router.get("/admin/reports", requireStaff(), wrap(async (req, res) => {
  await purgeExpiredReports();
  const status = ["open", "actioned", "dismissed"].includes(req.query.status) ? req.query.status : "open";
  const { data, error } = await serviceClient().from("reports")
    .select("id,reporter_id,reported_id,reason,details,status,resolution,created_at,resolved_at")
    .eq("status", status).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  res.json({ success: true, reports: data || [] });
}));
router.post("/admin/reports/:id/resolve", requireStaff(), wrap(async (req, res) => {
  const status = req.body?.status;
  const resolution = clean(req.body?.resolution || "").slice(0, 500);
  if (!["actioned", "dismissed"].includes(status) || resolution.length < 5) {
    return res.status(400).json({ success: false, message: "Choose a valid outcome and enter a resolution note (at least 5 characters)." });
  }
  if (req.body?.suspend_user === true && req.staffRole !== "admin") {
    return res.status(403).json({ success: false, message: "Only admins can suspend accounts." });
  }
  const { data: report, error: readError } = await serviceClient().from("reports")
    .select("id,reported_id,status").eq("id", req.params.id).maybeSingle();
  if (readError) throw readError;
  if (!report) return res.status(404).json({ success: false, message: "Report not found." });
  const { error } = await serviceClient().from("reports").update({
    status, resolution, resolved_by: req.user.id, resolved_at: new Date().toISOString()
  }).eq("id", report.id);
  if (error) throw error;
  if (req.body?.suspend_user === true) {
    const reason = resolution;
    const { error: enforceError } = await serviceClient().from("account_enforcements").upsert({
      user_id: report.reported_id, status: "suspended", reason, expires_at: null, created_by: req.user.id, updated_at: new Date().toISOString()
    });
    if (enforceError) throw enforceError;
    await audit(req.user.id, "account_suspended", report.reported_id, { report_id: report.id, reason });
  }
  await audit(req.user.id, "report_" + status, report.reported_id, { report_id: report.id, resolution });
  res.json({ success: true, status });
}));
router.post("/admin/users/:id/enforcement", requireStaff("admin"), wrap(async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ success: false, message: "An admin cannot change their own account status." });
  }
  const status = req.body?.status;
  const reason = clean(req.body?.reason || "").slice(0, 1000);
  const hours = Number(req.body?.duration_hours);
  if (!["suspended", "banned", "active"].includes(status) || reason.length < 5) {
    return res.status(400).json({ success: false, message: "Choose a valid enforcement status and provide a reason." });
  }
  const expiresAt = status === "suspended" && Number.isInteger(hours) && hours > 0 && hours <= 8760
    ? new Date(Date.now() + hours * 3600000).toISOString() : null;
  const { error } = await serviceClient().from("account_enforcements").upsert({
    user_id: req.params.id, status, reason, expires_at: expiresAt, created_by: req.user.id, updated_at: new Date().toISOString()
  });
  if (error) throw error;
  await audit(req.user.id, "account_" + status, req.params.id, { reason, expires_at: expiresAt });
  res.json({ success: true, status, expires_at: expiresAt });
}));
router.get("/admin/audit", requireStaff(), wrap(async (_req, res) => {
  const { data, error } = await serviceClient().from("audit_log")
    .select("id,actor_id,action,target_type,target_id,details,created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  res.json({ success: true, entries: data || [] });
}));
module.exports = { router, persistReport };
