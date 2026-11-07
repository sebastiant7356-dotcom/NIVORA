"use strict";
const express = require("express");
const { requireAuth, requireStaff } = require("../middleware");
const { serviceClient } = require("../lib/clients");
const { clean } = require("../lib/validation");
const { createLimiter, byUser } = require("../lib/ratelimit");

const router = express.Router();
router.use(requireAuth);
const REASONS = ["harassment", "fake_profile", "scam", "inappropriate_content", "underage", "other"];
const appealLimited = createLimiter({ windowMs: 60 * 60_000, max: 3, keyFn: byUser });
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
  const { error: appealError } = await serviceClient().from("account_appeals").delete()
    .lt("created_at", new Date(Date.now() - 90 * 86400000).toISOString());
  if (appealError) throw appealError;
  lastPurge = Date.now();
}
async function persistReport({ reporterId, reportedId, reason, details = "" }) {
  if (!reporterId || !reportedId || reporterId === reportedId || !REASONS.includes(reason)) {
    const e = new Error("Invalid report."); e.status = 400; throw e;
  }
  await purgeExpiredReports();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: duplicate, error: duplicateError } = await serviceClient().from("reports")
    .select("id").eq("reporter_id", reporterId).eq("reported_id", reportedId).gte("created_at", since).limit(1);
  if (duplicateError) throw duplicateError;
  if (duplicate?.length) {
    const e = new Error("You have already reported this account recently."); e.status = 409; throw e;
  }
  const { data, error } = await serviceClient().from("reports").insert({
    reporter_id: reporterId, reported_id: reportedId, match_id: null,
    reason, details: clean(details).slice(0, 500), status: "open"
  }).select("id,created_at").single();
  if (error) throw error;
  return data;
}
async function exportSafetyRecords(userId) {
  const { data: reports, error: reportError } = await serviceClient().from("reports")
    .select("id,reported_id,reason,details,status,resolution,created_at,resolved_at")
    .eq("reporter_id", userId).order("created_at", { ascending: false }).limit(200);
  if (reportError) throw reportError;
  const { data: appeals, error: appealError } = await serviceClient().from("account_appeals")
    .select("id,reason,status,resolution,created_at,resolved_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  if (appealError) throw appealError;
  return { reports: reports || [], appeals: appeals || [] };
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post("/account/appeal", appealLimited, wrap(async (req, res) => {
  const reason = clean(req.body?.reason || "").slice(0, 1000);
  if (reason.length < 5) return res.status(400).json({ success: false, message: "Enter an appeal reason of at least 5 characters." });
  const { data: enforcement, error: enforcementError } = await serviceClient().from("account_enforcements")
    .select("status").eq("user_id", req.user.id).maybeSingle();
  if (enforcementError) throw enforcementError;
  if (!enforcement || !["suspended", "banned"].includes(enforcement.status)) {
    return res.status(409).json({ success: false, message: "There is no active restriction to appeal." });
  }
  await purgeExpiredReports();
  const { data: pending, error: pendingError } = await serviceClient().from("account_appeals")
    .select("id").eq("user_id", req.user.id).eq("status", "open").limit(1);
  if (pendingError) throw pendingError;
  if (pending?.length) return res.status(409).json({ success: false, message: "You already have an appeal under review." });
  const { data, error } = await serviceClient().from("account_appeals")
    .insert({ user_id: req.user.id, reason }).select("id,status,created_at").single();
  if (error) throw error;
  res.status(201).json({ success: true, appeal: data });
}));
router.get("/admin/me", requireStaff(), (req, res) => res.json({ success: true, role: req.staffRole }));
router.get("/admin/reports", requireStaff(), wrap(async (req, res) => {
  await purgeExpiredReports();
  const status = ["open", "actioned", "dismissed"].includes(req.query.status) ? req.query.status : "open";
  const { data, error } = await serviceClient().from("reports")
    .select("id,reporter_id,reported_id,reason,details,status,resolution,created_at,resolved_at")
    .eq("status", status).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const counts = new Map();
  for (const row of data || []) if (row.reported_id) counts.set(row.reported_id, (counts.get(row.reported_id) || 0) + 1);
  res.json({ success: true, reports: (data || []).map(row => ({ ...row, repeat_report_count: counts.get(row.reported_id) || 1 })) });
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
router.get("/admin/appeals", requireStaff(), wrap(async (_req, res) => {
  await purgeExpiredReports();
  const { data, error } = await serviceClient().from("account_appeals")
    .select("id,user_id,reason,status,resolution,created_at,resolved_at")
    .eq("status", "open").order("created_at", { ascending: true }).limit(200);
  if (error) throw error;
  res.json({ success: true, appeals: data || [] });
}));
router.post("/admin/appeals/:id/resolve", requireStaff(), wrap(async (req, res) => {
  const status = req.body?.status;
  const resolution = clean(req.body?.resolution || "").slice(0, 500);
  if (!["approved", "rejected"].includes(status) || resolution.length < 5) {
    return res.status(400).json({ success: false, message: "Choose an outcome and enter a resolution note (at least 5 characters)." });
  }
  if (status === "approved" && req.staffRole !== "admin") {
    return res.status(403).json({ success: false, message: "Only an admin can reinstate an account after appeal." });
  }
  const { data: appeal, error: readError } = await serviceClient().from("account_appeals")
    .select("id,user_id,status").eq("id", req.params.id).maybeSingle();
  if (readError) throw readError;
  if (!appeal || appeal.status !== "open") return res.status(404).json({ success: false, message: "Open appeal not found." });
  const { error } = await serviceClient().from("account_appeals").update({
    status, resolution, resolved_by: req.user.id, resolved_at: new Date().toISOString()
  }).eq("id", appeal.id);
  if (error) throw error;
  if (status === "approved" && appeal.user_id) {
    const { error: reinstateError } = await serviceClient().from("account_enforcements")
      .delete().eq("user_id", appeal.user_id);
    if (reinstateError) throw reinstateError;
  }
  await audit(req.user.id, "appeal_" + status, appeal.user_id || appeal.id, { appeal_id: appeal.id, resolution });
  res.json({ success: true, status });
}));
router.get("/admin/enforcements", requireStaff("admin"), wrap(async (_req, res) => {
  const { data, error } = await serviceClient().from("account_enforcements")
    .select("user_id,status,reason,expires_at,created_at,updated_at")
    .in("status", ["suspended", "banned"]).order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  res.json({ success: true, accounts: data || [] });
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
  const enforcementQuery = status === "active"
    ? serviceClient().from("account_enforcements").delete().eq("user_id", req.params.id)
    : serviceClient().from("account_enforcements").upsert({
        user_id: req.params.id, status, reason, expires_at: expiresAt, created_by: req.user.id, updated_at: new Date().toISOString()
      });
  const { error } = await enforcementQuery;
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
module.exports = { router, persistReport, exportSafetyRecords };
