"use strict";
require("./stubs/install");
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "pub";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";

const UID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const MATCH = "33333333-3333-4333-8333-333333333333";

function res() {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
async function call(router, method, path, { body, params = {}, query = {}, user = { id: UID }, headers = {} } = {}) {
  const route = router.routes.find((x) => x.method === method && x.path === path);
  assert.ok(route, `route ${method} ${path} exists`);
  const req = { body, params, query, user, headers };
  const out = res();
  // run route-level middleware (limiters etc.) then the handler
  const { requireAuth } = require("../src/middleware");
  for (const h of route.handlers) { if (h === requireAuth) continue; let nexted = false; await h(req, out, () => { nexted = true; }); if (!nexted) break; }
  return out;
}
const when = (fn) => { globalThis.__fakeDb = fn; };

test("every module loads and the app wires all routers", () => {
  const { createApp } = require("../src/server");
  assert.ok(createApp());
});

test("admin cannot approve their own profile", async () => {
  when(() => { throw new Error("DB must not be touched"); });
  const router = require("../src/routes/admin");
  const r = await call(router, "POST", "/profiles/:id/decision", { params: { id: UID }, body: { decision: "approved" } });
  assert.equal(r.code, 403);
});
test("decision requires valid value and a reason for reject", async () => {
  const router = require("../src/routes/admin");
  assert.equal((await call(router, "POST", "/profiles/:id/decision", { params: { id: OTHER }, body: { decision: "hacked" } })).code, 400);
  assert.equal((await call(router, "POST", "/profiles/:id/decision", { params: { id: OTHER }, body: { decision: "rejected", reason: "no" } })).code, 400);
});
test("requireStaff blocks non-staff and allows listed roles", async () => {
  const { requireStaff } = require("../src/middleware");
  when((c) => (c.table === "staff_roles" ? { data: null, error: null } : { data: null, error: null }));
  let r = res(); let nexted = false;
  await requireStaff()({ user: { id: UID } }, r, () => { nexted = true; });
  assert.equal(r.code, 403); assert.equal(nexted, false);
  when(() => ({ data: { role: "moderator" }, error: null }));
  r = res(); nexted = false;
  await requireStaff("admin")({ user: { id: UID } }, r, () => { nexted = true; });
  assert.equal(r.code, 403, "moderator cannot pass admin-only gate");
  r = res(); nexted = false;
  await requireStaff()({ user: { id: UID } }, r, () => { nexted = true; });
  assert.equal(nexted, true);
});

test("requireAuth rejects missing token, email-only accounts and unconfirmed phones", async () => {
  const { requireAuth } = require("../src/middleware");
  let r = res(); await requireAuth({ headers: {} }, r, () => {}); assert.equal(r.code, 401);
  globalThis.__fakeAuth = async () => ({ data: { user: { id: UID, email: "a@b.c" } }, error: null });
  r = res(); await requireAuth({ headers: { authorization: "Bearer x" } }, r, () => {}); assert.equal(r.code, 403);
  globalThis.__fakeAuth = async () => ({ data: { user: { id: UID, phone: "919876543210" } }, error: null });
  r = res(); await requireAuth({ headers: { authorization: "Bearer x" } }, r, () => {}); assert.equal(r.code, 403, "phone not confirmed");
  globalThis.__fakeAuth = async () => ({ data: { user: { id: UID, phone: "919876543210", phone_confirmed_at: "2026-01-01" } }, error: null });
  const req = { headers: { authorization: "Bearer x" } }; let ok = false;
  await requireAuth(req, res(), () => { ok = true; });
  assert.ok(ok); assert.deepEqual(req.user, { id: UID }, "only the immutable id is kept");
});

test("chat gate: expired window, non-member and blocked are all refused", async () => {
  const { assertLiveMatch } = require("../src/lib/matches");
  const future = new Date(Date.now() + 3600e3).toISOString(), past = new Date(Date.now() - 1000).toISOString();
  const base = { id: MATCH, user_one: UID, user_two: OTHER, status: "active" };
  when((c) => (c.table === "match_history" ? { data: { ...base, expires_at: past }, error: null } : { data: [], error: null }));
  let g = await assertLiveMatch(MATCH, UID); assert.equal(g.status, 403); assert.equal(g.code, "match_not_live");
  when((c) => (c.table === "match_history" ? { data: { ...base, expires_at: future }, error: null } : { data: [], error: null }));
  g = await assertLiveMatch(MATCH, "99999999-9999-4999-8999-999999999999"); assert.equal(g.status, 404, "stranger gets 404");
  g = await assertLiveMatch(MATCH, UID); assert.equal(g.partnerId, OTHER);
  when((c) => (c.table === "match_history" ? { data: { ...base, status: "ended", expires_at: future }, error: null } : { data: [], error: null }));
  g = await assertLiveMatch(MATCH, UID); assert.equal(g.status, 403, "ended match closed even inside 72h");
  when((c) => (c.table === "match_history" ? { data: { ...base, expires_at: future }, error: null } : { data: [{ blocker_id: OTHER }], error: null }));
  g = await assertLiveMatch(MATCH, UID); assert.equal(g.code, "blocked");
});

test("chat send is refused after expiry and never inserts", async () => {
  let inserted = false;
  when((c) => {
    if (c.table === "messages") { inserted = true; return { data: { id: "m", body: "x", created_at: "t" }, error: null }; }
    if (c.table === "match_history") return { data: { id: MATCH, user_one: UID, user_two: OTHER, status: "active", expires_at: new Date(Date.now() - 5).toISOString() }, error: null };
    return { data: [], error: null };
  });
  const r = await call(require("../src/routes/chat"), "POST", "/:matchId/messages", { params: { matchId: MATCH }, body: { body: "hello" } });
  assert.equal(r.code, 403); assert.equal(inserted, false);
});

test("matching: unapproved user gets 403 from the DB function's error; only verified id is passed", async () => {
  let args;
  when((c) => { if (c.rpc === "nivora_find_partner") { args = c.args; return { data: null, error: { message: "not_approved" } }; } return { data: null, error: null }; });
  const r = await call(require("../src/routes/match"), "POST", "/find", { body: { user_id: OTHER, p_user: OTHER } });
  assert.equal(r.code, 403); assert.equal(args.p_user, UID, "client-supplied id ignored");
});
test("matching: second active match maps to 409", async () => {
  when((c) => (c.rpc === "nivora_find_partner" ? { data: null, error: { message: "duplicate", code: "23505" } } : { data: null, error: null }));
  assert.equal((await call(require("../src/routes/match"), "POST", "/find")).code, 409);
});
test("match response never contains phone, email or last name", async () => {
  const { partnerView } = require("../src/lib/matches");
  const v = partnerView({ full_name: "Ananya Nair", age: 26, district: "Kochi", phone: "+91999", email: "a@b.c", core_values: ["family"], bio: "hi" }, ["family"]);
  assert.equal(JSON.stringify(v).includes("Nair"), false); assert.equal("phone" in v, false); assert.equal("email" in v, false);
  assert.deepEqual(v.shared_values, ["family"]);
});

test("profile: duplicate create -> 409; rejected profiles cannot edit; approved edit goes back to pending", async () => {
  const router = require("../src/routes/profile");
  const body = { full_name: "Ananya Nair", age: 26, district: "Kochi", gender: "woman", looking_for: "man", relationship_intention: "marriage", core_values: ["family"], consents: { terms: true, privacy: true } };
  when((c) => (c.table === "profiles" ? { data: { id: UID }, error: null } : { data: null, error: null }));
  assert.equal((await call(router, "POST", "/", { body })).code, 409);
  when(() => ({ data: { approval_status: "rejected" }, error: null }));
  assert.equal((await call(router, "PUT", "/", { body: { bio: "new bio text here" } })).code, 403);
  let update;
  when((c) => {
    const u = c.table === "profiles" ? c.ops.find((o) => o[0] === "update") : null;
    if (u && !update) { update = u[1]; return { data: { id: UID, approval_status: "pending" }, error: null }; }
    return { data: { approval_status: "approved" }, error: null };
  });
  const r = await call(router, "PUT", "/", { body: { bio: "a changed biography text", approval_status: "approved" } });
  assert.equal(r.code, 200); assert.equal(update.approval_status, "pending", "client-sent status ignored; re-review forced");
});
test("profile create stores verified id, forced pending status and consent timestamps", async () => {
  const router = require("../src/routes/profile");
  let row;
  when((c) => {
    const ins = c.table === "profiles" ? c.ops.find((o) => o[0] === "insert") : null;
    if (ins) { row = row || ins[1]; return { data: { ...ins[1] }, error: null }; }
    if (c.ops.find((o) => o[0] === "maybeSingle")) return { data: null, error: null };
    return { data: null, error: null };
  });
  const r = await call(router, "POST", "/", { body: { full_name: "Ananya Nair", age: 26, district: "Kochi", gender: "woman", looking_for: "man", relationship_intention: "marriage", core_values: ["family"], consents: { terms: true, privacy: true }, id: OTHER, approval_status: "approved" } });
  assert.equal(r.code, 201); assert.equal(row.id, UID); assert.equal(row.approval_status, "pending");
  assert.ok(row.consent_terms_at && row.consent_privacy_at && row.consent_version);
});

test("payments: forged signature never marks a payment paid", async () => {
  process.env.RAZORPAY_KEY_ID = "k"; process.env.RAZORPAY_KEY_SECRET = "s";
  const cfgPath = require.resolve("../src/config"); delete require.cache[cfgPath];
  require("../src/config");
  delete require.cache[require.resolve("../src/routes/payments")];
  const { router } = require("../src/routes/payments");
  let updated = false;
  when((c) => { if (c.ops.find((o) => o[0] === "update")) updated = true; return { data: { id: "p", status: "created", amount_paise: 5000 }, error: null }; });
  const r = await call(router, "POST", "/verify", { body: { razorpay_order_id: "order_abc123", razorpay_payment_id: "pay_abc123", razorpay_signature: "forged_signature_value" } });
  assert.equal(r.code, 400); assert.equal(updated, false);
});
test("payments: duplicate webhook event is acknowledged without reprocessing", async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec";
  const cfgPath = require.resolve("../src/config"); delete require.cache[cfgPath];
  delete require.cache[require.resolve("../src/lib/razorpay")]; delete require.cache[require.resolve("../src/routes/payments")];
  const { webhookHandler } = require("../src/routes/payments");
  const rz = require("../src/lib/razorpay");
  const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "o1", amount: 5000, currency: "INR", status: "captured" } } } });
  const sig = rz.hmacHex("whsec", raw);
  let processed = false;
  when((c) => { if (c.table === "payment_webhook_events") return { data: null, error: { code: "23505" } }; processed = true; return { data: null, error: null }; });
  const out = res();
  await webhookHandler({ body: Buffer.from(raw), headers: { "x-razorpay-signature": sig, "x-razorpay-event-id": "evt_1" } }, out);
  assert.equal(out.body.duplicate, true); assert.equal(processed, false);
  const bad = res();
  await webhookHandler({ body: Buffer.from(raw), headers: { "x-razorpay-signature": "bad", "x-razorpay-event-id": "evt_2" } }, bad);
  assert.equal(bad.code, 400);
});
