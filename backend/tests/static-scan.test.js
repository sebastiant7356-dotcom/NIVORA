"use strict";
// Repository hygiene: no secrets, no localhost URLs baked into production code, no fake-success flows, no .env.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", ".git"].includes(e.name)) continue;
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const text = (f) => fs.readFileSync(f, "utf8");
const code = files.filter((f) => /\.(js|html|sql|md|json)$/.test(f) && !f.includes("package-lock") && !f.endsWith("static-scan.test.js"));

test("no .env files and no private keys shipped", () => {
  assert.deepEqual(files.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".env.example")), []);
  for (const f of code) {
    const t = text(f);
    assert.ok(!/service_role['"]?\s*[:=]\s*['"]eyJ/.test(t), "service key in " + f);
    assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t), "private key in " + f);
    assert.ok(!/rzp_(live|test)_[A-Za-z0-9]{8,}/.test(t), "razorpay key in " + f);
  }
});
test("frontend never references the service-role key", () => {
  for (const f of code.filter((x) => x.includes(`${path.sep}frontend${path.sep}`))) assert.ok(!/SERVICE_ROLE|service_role_key/i.test(text(f)), f);
});
test("frontend has no hardcoded localhost API URL and no email/password sign-in", () => {
  for (const f of code.filter((x) => x.includes(`${path.sep}frontend${path.sep}`) && x.endsWith(".js") && !x.endsWith("README.md"))) {
    const t = text(f);
    assert.ok(!/["'`]https?:\/\/(127\.0\.0\.1|localhost)/.test(t), "hardcoded localhost in " + f);
    assert.ok(!/signInWithPassword|prompt\([^)]*[Pp]assword/.test(t), "password login in " + f);
  }
});
test("backend never logs request bodies, tokens or phone numbers", () => {
  for (const f of code.filter((x) => x.includes(`${path.sep}src${path.sep}`))) {
    for (const line of text(f).split("\n").filter((l) => /console\.(log|error|warn)/.test(l))) {
      assert.ok(!/req\.body|authorization|token|otp|phone|password/i.test(line), `${f}: ${line.trim()}`);
    }
  }
});
test("SQL: RLS enabled and matching functions not callable by browser roles", () => {
  const sql = text(path.join(ROOT, "backend", "migrations", "001_core_schema.sql"));
  for (const t of ["profiles", "match_history", "messages", "payments", "staff_roles", "reports", "audit_log"]) assert.ok(sql.includes(`'${t}'`), t);
  assert.ok(/enable row level security/.test(sql));
  assert.ok(/revoke all on function public\.nivora_find_partner\(uuid, boolean\)\s+from public, anon, authenticated/.test(sql));
  assert.ok(!/grant (insert|update|delete)[^;]*to (anon|authenticated)/i.test(sql));
});

test("BEYOND minimal-data mode mounts volatile session APIs, not legacy persistence routes", () => {
  const server = text(path.join(ROOT, "backend", "src", "server.js"));
  const api = text(path.join(ROOT, "backend", "src", "routes", "ephemeral-api.js"));
  const portal = text(path.join(ROOT, "frontend", "portal.js"));
  assert.ok(server.includes('app.use("/api", require("./routes/ephemeral-api"))'));
  for (const route of ["profile", "match", "shake", "friends", "community", "chat", "safety", "account", "admin"]) {
    assert.ok(!server.includes('require("./routes/' + route + '")'), "legacy route mounted: " + route);
  }
  assert.ok(!api.includes(".from("));
  assert.ok(!api.includes(".storage."));
  assert.ok(api.includes("new EphemeralStore"));
  assert.ok(api.includes("mutual"));
  assert.ok(api.includes("profile_visibility"));
  assert.ok(portal.includes("Photo sharing is disabled"));
});

test("voice and photo uploads are disabled in minimal-data mode", () => {
  const api = text(path.join(ROOT, "backend", "src", "routes", "ephemeral-api.js"));
  const server = text(path.join(ROOT, "backend", "src", "server.js"));
  const portal = text(path.join(ROOT, "frontend", "portal.js"));
  assert.ok(api.includes("voice_disabled"));
  assert.ok(api.includes("photos_disabled"));
  assert.ok(!server.includes("express.raw"));
  assert.ok(!portal.includes('id="voiceRecord"'));
  assert.ok(!portal.includes('id="photoInput"'));
});

test("staff accounts cannot become customer profiles or receive matches", () => {
  const profile = text(path.join(ROOT, "backend", "src", "routes", "profile.js"));
  // This is the migration actually present in the repository and applied to Supabase.
  const migration = text(path.join(ROOT, "backend", "migrations", "20261101184824_staff_separation_security_performance.sql"));
  const account = text(path.join(ROOT, "backend", "src", "routes", "account.js"));
  assert.match(profile, /Staff accounts do not use customer profiles/);
  assert.match(migration, /staff_not_customer/);
  assert.match(migration, /not exists \(select 1 from public\.staff_roles sr where sr\.user_id = c\.id\)/);
  assert.match(account, /Staff accounts must be managed by an administrator/);
});


test("staff moderation is limited to reported accounts", () => {
  const admin = text(path.join(ROOT, "backend", "src", "routes", "admin.js"));
  const ui = text(path.join(ROOT, "frontend", "admin.js"));
  assert.match(admin, /Routine profile review is disabled/);
  assert.match(admin, /hasOpenReport\(db, req\.params\.id\)/);
  assert.match(admin, /viewed_reported_profile/);
  assert.match(admin, /Routine AI screening is disabled/);
  assert.match(ui, /let tab = "reports"/);
  assert.doesNotMatch(ui, /const TABS = \[\["pending"/);
});


test("SECURITY DEFINER RLS helpers live outside the public API schema", () => {
  const migration = text(path.join(ROOT, "backend", "migrations", "20261101184918_private_rls_helpers_and_voice_sender_index.sql"));
  assert.match(migration, /create schema if not exists private/);
  assert.match(migration, /private\.nivora_is_staff/);
  assert.match(migration, /private\.nivora_can_access_chat/);
  assert.match(migration, /revoke all on function public\.nivora_is_staff\(\) from public, anon, authenticated/);
  assert.match(migration, /voice_messages_sender_created_idx/);
});


test("account deletion fails closed when cleanup or audit steps fail", () => {
  const account = text(path.join(ROOT, "backend", "src", "routes", "account.js"));
  assert.match(account, /if \(feedbackDeleteError\) throw feedbackDeleteError/);
  assert.match(account, /if \(memberDeleteError\) throw memberDeleteError/);
  assert.match(account, /if \(paymentDetachError\) throw paymentDetachError/);
  assert.match(account, /if \(!auditOk\) throw new Error/);
  assert.match(account, /if \(error\) \{[\s\S]*?throw error;[\s\S]*?Limited registration details are retained for 180 days/);
});


test("account deletion preserves only registration identifiers for 180 days", () => {
  const account = text(path.join(ROOT, "backend", "src", "routes", "account.js"));
  const migration = text(path.join(ROOT, "backend", "migrations", "20261104100000_account_deletion_180_day_retention.sql"));
  assert.match(account, /auth\.admin\.getUserById\(id\)/);
  assert.match(account, /registration_email: authUser\.email/);
  assert.match(account, /registration_provider: authUser\.app_metadata\?\.provider/);
  assert.match(account, /180 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(account, /account_deletion_retention/);
  assert.match(account, /Limited registration details are retained for 180 days/);
  assert.match(migration, /check \(purge_after = cancelled_at \+ interval '180 days'\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.account_deletion_retention from public, anon, authenticated/);
  assert.match(migration, /cron\.schedule/);
  assert.match(migration, /purge_expired_account_registration_records/);
});


test("anonymous post author foreign key has a supporting index migration", () => {
  const migration = text(path.join(ROOT, "backend", "migrations", "20261110000000_anonymous_posts_author_index.sql"));
  assert.match(migration, /create index if not exists anonymous_posts_author_id_idx/);
  assert.match(migration, /on public\.anonymous_posts\(author_id\)/);
});
