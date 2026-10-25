"use strict";
const crypto = require("node:crypto");
const config = require("../config");

const API = "https://api.razorpay.com/v1";

function authHeader() {
  return "Basic " + Buffer.from(`${config.payment.keyId}:${config.payment.keySecret}`).toString("base64");
}

function hmacHex(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Checkout callback signature: HMAC_SHA256(order_id|payment_id, key_secret) */
function verifyCheckoutSignature(orderId, paymentId, signature, secret = config.payment.keySecret) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  return safeEqualHex(hmacHex(secret, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC_SHA256(raw_body, webhook_secret) */
function verifyWebhookSignature(rawBody, signature, secret = config.payment.webhookSecret) {
  if (!rawBody || !signature || !secret) return false;
  return safeEqualHex(hmacHex(secret, rawBody), signature);
}

async function rp(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error("gateway_error");
    err.status = res.status;
    throw err;
  }
  return data;
}

const createOrder = ({ amountPaise, receipt, notes }) =>
  rp("POST", "/orders", { amount: amountPaise, currency: "INR", receipt, notes });
const fetchPayment = (paymentId) => rp("GET", `/payments/${encodeURIComponent(paymentId)}`);

/** True only if the gateway itself says this payment is captured for the expected order and amount. */
function paymentMatches(gatewayPayment, { orderId, amountPaise }) {
  return Boolean(
    gatewayPayment &&
    gatewayPayment.order_id === orderId &&
    gatewayPayment.amount === amountPaise &&
    gatewayPayment.currency === "INR" &&
    gatewayPayment.status === "captured"
  );
}

module.exports = {
  verifyCheckoutSignature, verifyWebhookSignature, createOrder, fetchPayment, paymentMatches, hmacHex
};
