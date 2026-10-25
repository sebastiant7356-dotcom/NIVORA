"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const rz = require("../src/lib/razorpay");
const { createLimiter } = require("../src/lib/ratelimit");

test("checkout signature: valid accepted, tampered rejected", () => {
  const secret = "test_secret_not_real";
  const sig = crypto.createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
  assert.equal(rz.verifyCheckoutSignature("order_1", "pay_1", sig, secret), true);
  assert.equal(rz.verifyCheckoutSignature("order_1", "pay_2", sig, secret), false);
  assert.equal(rz.verifyCheckoutSignature("order_1", "pay_1", "00", secret), false);
  assert.equal(rz.verifyCheckoutSignature("order_1", "pay_1", sig, ""), false); // no secret => never valid
});
test("webhook signature checks raw body", () => {
  const secret = "whsec_test"; const body = '{"event":"payment.captured"}';
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(rz.verifyWebhookSignature(body, sig, secret), true);
  assert.equal(rz.verifyWebhookSignature(body + " ", sig, secret), false);
  assert.equal(rz.verifyWebhookSignature(body, undefined, secret), false);
});
test("paymentMatches requires captured status, same order, exact amount, INR", () => {
  const ok = { order_id: "o1", amount: 5000, currency: "INR", status: "captured" };
  assert.equal(rz.paymentMatches(ok, { orderId: "o1", amountPaise: 5000 }), true);
  assert.equal(rz.paymentMatches({ ...ok, status: "authorized" }, { orderId: "o1", amountPaise: 5000 }), false);
  assert.equal(rz.paymentMatches({ ...ok, amount: 100 }, { orderId: "o1", amountPaise: 5000 }), false);
  assert.equal(rz.paymentMatches({ ...ok, order_id: "o2" }, { orderId: "o1", amountPaise: 5000 }), false);
  assert.equal(rz.paymentMatches(null, { orderId: "o1", amountPaise: 5000 }), false);
});
test("rate limiter blocks after max and sets Retry-After", () => {
  const lim = createLimiter({ windowMs: 60000, max: 2, keyFn: () => "k" });
  const mk = () => { const h = {}; return { h, res: { setHeader: (k, v) => (h[k] = v), status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } } }; };
  let passed = 0; const next = () => passed++;
  for (let i = 0; i < 3; i++) { const { res, h } = mk(); lim({}, res, next); if (i === 2) { assert.equal(res.code, 429); assert.ok(h["Retry-After"]); } }
  assert.equal(passed, 2);
});
test("config: missing required secrets are reported by name only", () => {
  const cfgPath = require.resolve("../src/config");
  const saved = { ...process.env };
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_PUBLISHABLE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete require.cache[cfgPath];
  const cfg = require("../src/config");
  const m = cfg.missing();
  assert.ok(m.includes("SUPABASE_URL") && m.includes("SUPABASE_SERVICE_ROLE_KEY"));
  Object.assign(process.env, saved); delete require.cache[cfgPath];
});
