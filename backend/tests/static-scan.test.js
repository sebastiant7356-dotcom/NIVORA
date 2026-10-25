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
