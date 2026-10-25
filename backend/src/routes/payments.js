"use strict";
const express = require("express");
const config = require("../config");
const { serviceClient } = require("../lib/clients");
const { requireAuth } = require("../middleware");
const { createLimiter, byUser } = require("../lib/ratelimit");
const rzp = require("../lib/razorpay");
const { audit } = require("../lib/audit");

const SECRET_MISSING = { success: false, code: "payments_not_configured", message: "Payments are not enabled on this server yet." };

/** Atomically move created -> paid. Idempotent: returns the row if already paid. Never trusts caller data. */
async function markPaid(db, { orderId, paymentId, amountPaise }) {
  const { data, error } = await db.from("payments")
    .update({ status: "paid", provider_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq("provider_order_id", orderId).eq("status", "created").eq("amount_paise", amountPaise)
    .select("id, user_id, status").maybeSingle();
  if (error) throw error;
  if (data) return { row: data, changed: true };
  const { data: existing } = await db.from("payments").select("id, user_id, status, provider_payment_id")
    .eq("provider_order_id", orderId).maybeSingle();
  return { row: existing, changed: false };
}

// ---- Authenticated user routes ----
const router = express.Router();
const orderLimit = createLimiter({ windowMs: 60 * 60_000, max: 10, keyFn: byUser });

router.get("/status", requireAuth, async (req, res) => {
  const { data } = await serviceClient().from("payments").select("status, consumed_at, paid_at, amount_paise")
    .eq("user_id", req.user.id).order("created_at", { ascending: false }).limit(10);
  const credit = (data || []).some((p) => p.status === "paid" && !p.consumed_at);
  res.json({
    success: true, enabled: config.payment.enabled, required: config.payment.required,
    amount_paise: config.payment.amountPaise, has_credit: credit, payments: data || []
  });
});

router.post("/order", requireAuth, orderLimit, async (req, res) => {
  if (!config.payment.enabled) return res.status(503).json(SECRET_MISSING);
  const db = serviceClient();
  const { data: prof } = await db.from("profiles").select("approval_status").eq("id", req.user.id).maybeSingle();
  if (!prof || prof.approval_status !== "approved") {
    return res.status(403).json({ success: false, message: "Payment is available after your profile is approved." });
  }
  const { data: credit } = await db.from("payments").select("id").eq("user_id", req.user.id).eq("status", "paid").is("consumed_at", null).limit(1);
  if (credit && credit.length) return res.status(409).json({ success: false, code: "credit_exists", message: "You already have an unused paid match credit." });

  // Retire stale unpaid orders (>30 min), reuse a fresh open one to avoid duplicates.
  await db.from("payments").update({ status: "failed" }).eq("user_id", req.user.id).eq("status", "created")
    .lt("created_at", new Date(Date.now() - 30 * 60_000).toISOString());
  const { data: open } = await db.from("payments").select("provider_order_id, amount_paise")
    .eq("user_id", req.user.id).eq("status", "created").maybeSingle();
  if (open) {
    return res.json({ success: true, order_id: open.provider_order_id, amount: open.amount_paise, currency: "INR", key_id: config.payment.keyId });
  }

  let order;
  try {
    order = await rzp.createOrder({
      amountPaise: config.payment.amountPaise,
      receipt: `nv_${Date.now().toString(36)}_${req.user.id.slice(0, 8)}`,
      notes: { purpose: "nivora_match_credit" }
    });
  } catch {
    return res.status(502).json({ success: false, message: "Payment gateway is unavailable. Please try again." });
  }
  const { error } = await db.from("payments").insert({
    user_id: req.user.id, provider_order_id: order.id, amount_paise: order.amount, currency: order.currency, receipt: order.receipt
  });
  if (error) return res.status(500).json({ success: false, message: "Could not record the order." });
  await audit(req.user.id, "payment_order_created", "payment", order.id);
  res.json({ success: true, order_id: order.id, amount: order.amount, currency: order.currency, key_id: config.payment.keyId });
});

// The browser callback is only a *hint*. We re-verify the HMAC AND ask the gateway directly.
router.post("/verify", requireAuth, async (req, res) => {
  if (!config.payment.enabled) return res.status(503).json(SECRET_MISSING);
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = req.body || {};
  if (![orderId, paymentId, sig].every((x) => typeof x === "string" && x.length > 5 && x.length < 200)) {
    return res.status(400).json({ success: false, message: "Invalid payment details." });
  }
  const db = serviceClient();
  const { data: row } = await db.from("payments").select("id, status, amount_paise")
    .eq("provider_order_id", orderId).eq("user_id", req.user.id).maybeSingle();
  if (!row) return res.status(404).json({ success: false, message: "Order not found." });
  if (row.status === "paid") return res.json({ success: true, status: "paid", duplicate: true });

  if (!rzp.verifyCheckoutSignature(orderId, paymentId, sig)) {
    return res.status(400).json({ success: false, message: "Payment signature could not be verified." });
  }
  let gw;
  try { gw = await rzp.fetchPayment(paymentId); }
  catch { return res.status(502).json({ success: false, message: "Could not confirm payment with the gateway. If money was deducted it will be reconciled automatically." }); }
  if (!rzp.paymentMatches(gw, { orderId, amountPaise: row.amount_paise })) {
    return res.status(409).json({ success: false, message: "Payment is not confirmed yet. If money was deducted, it will be credited automatically after confirmation." });
  }
  try {
    const { row: updated } = await markPaid(db, { orderId, paymentId, amountPaise: row.amount_paise });
    if (!updated || updated.status !== "paid") return res.status(409).json({ success: false, message: "Payment could not be recorded." });
    await audit(req.user.id, "payment_verified", "payment", orderId);
    res.json({ success: true, status: "paid" });
  } catch (e) {
    if (e?.code === "23505") return res.status(409).json({ success: false, message: "This payment reference was already used." });
    res.status(500).json({ success: false, message: "Could not record payment." });
  }
});

// ---- Webhook (mounted in server.js with express.raw BEFORE express.json) ----
async function webhookHandler(req, res) {
  if (!config.payment.webhookSecret) return res.status(503).json(SECRET_MISSING);
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!rzp.verifyWebhookSignature(raw, req.headers["x-razorpay-signature"])) {
    return res.status(400).json({ success: false, message: "Invalid signature." });
  }
  let evt;
  try { evt = JSON.parse(raw); } catch { return res.status(400).json({ success: false, message: "Invalid payload." }); }
  const eventId = String(req.headers["x-razorpay-event-id"] || "");
  if (!eventId) return res.status(400).json({ success: false, message: "Missing event id." });

  const db = serviceClient();
  const { error: dupErr } = await db.from("payment_webhook_events").insert({ event_id: eventId, event_type: evt.event });
  if (dupErr) {
    if (dupErr.code === "23505") return res.json({ success: true, duplicate: true }); // already processed
    return res.status(500).json({ success: false });
  }
  try {
    const p = evt.payload?.payment?.entity;
    if (p && ["payment.captured", "order.paid"].includes(evt.event)) {
      const orderId = p.order_id;
      const { data: row } = await db.from("payments").select("amount_paise").eq("provider_order_id", orderId).maybeSingle();
      if (row && rzp.paymentMatches(p, { orderId, amountPaise: row.amount_paise })) {
        const r = await markPaid(db, { orderId, paymentId: p.id, amountPaise: row.amount_paise });
        if (r.changed) await audit(null, "payment_webhook_paid", "payment", orderId);
      }
    } else if (p && evt.event === "payment.failed") {
      await db.from("payments").update({ status: "failed" }).eq("provider_order_id", p.order_id).eq("status", "created");
    }
    return res.json({ success: true });
  } catch {
    await db.from("payment_webhook_events").delete().eq("event_id", eventId); // let the gateway retry
    return res.status(500).json({ success: false });
  }
}

module.exports = { router, webhookHandler, markPaid };
