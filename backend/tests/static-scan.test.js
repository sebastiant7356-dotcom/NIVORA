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

test("daily five matching and multiple live match UI are wired together", () => {
  const migration = text(path.join(ROOT, "backend", "migrations", "20261101182853_daily_five_multiple_matches.sql"));
  const route = text(path.join(ROOT, "backend", "src", "routes", "match.js"));
  const portal = text(path.join(ROOT, "frontend", "portal.js"));
  assert.match(migration, /create table if not exists public\.match_daily_usage/);
  assert.match(migration, /time zone 'Asia\/Kolkata'/);
  assert.match(migration, /matches_count between 0 and 5/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /daily_match_limit_reached/);
  assert.match(migration, /primary key \(user_id, match_id\)/);
  assert.match(migration, /match_history_pair_unique_idx/);
  assert.match(migration, /grant execute on function public\.nivora_find_partner\(uuid, boolean\) to service_role/);
  assert.match(route, /dailyUsage\(req\.user\.id\)/);
  assert.match(route, /matches, match: matches\[0\] \|\| null/);
  assert.match(portal, /dailyQuota\.daily_used/);
  assert.match(portal, /data-match-id/);
  assert.match(portal, /matches\.map/);
});


test("voice messages stay private, size-limited and restricted to match members", () => {
  const migration = text(path.join(ROOT, "backend", "migrations", "20261101184818_voice_messages.sql"));
  const hardeningMigration = text(path.join(ROOT, "backend", "migrations", "20261101184824_staff_separation_security_performance.sql"));
  const route = text(path.join(ROOT, "backend", "src", "routes", "chat.js"));
  const server = text(path.join(ROOT, "backend", "src", "server.js"));
  const portal = text(path.join(ROOT, "frontend", "portal.js"));
  const staff = text(path.join(ROOT, "backend", "src", "routes", "admin.js"));
  const middleware = text(path.join(ROOT, "backend", "src", "middleware.js"));
  assert.match(migration, /public\.voice_messages/);
  assert.match(migration, /values \('voice-messages', 'voice-messages', false, 2097152/);
  assert.match(migration, /revoke all on table public\.voice_messages from public, anon, authenticated/);
  assert.match(hardeningMigration, /voice_messages_deny_browser/);
  assert.match(route, /assertChatMatch\(req\.params\.matchId, req\.user\.id\)/);
  assert.match(route, /MAX_VOICE_BYTES = 2 \* 1024 \* 1024/);
  assert.match(route, /duration > 60/);
  assert.match(route, /count >= 20/);
  assert.match(middleware, /X-Voice-Duration/);
  assert.match(server, /\/api\/chat\/:matchId\/voice.*express\.raw/);
  assert.match(portal, /MediaRecorder/);
  assert.match(portal, /\/api\/chat\/.*\/voice/);
  assert.match(staff, /viewed_reported_voice/);
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
  assert.match(account, /if \(error\) throw error;[\s\S]*?res\.json\(\{ success: true, message: "Your account and personal data have been deleted\." \}\)/);
});
