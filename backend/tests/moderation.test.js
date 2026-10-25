"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { assessProfile, redact } = require("../src/lib/moderation-ai");

const base = { full_name: "Arun Kumar", age: 30, district: "Thrissur", job_title: "Engineer", bio: "Quiet, family-minded person who enjoys cooking." };

test("clean profile has no flags", () => {
  const r = assessProfile(base);
  assert.equal(r.flags.length, 0); assert.equal(r.score, 0);
});
test("scam wording and contact info are flagged but never decide anything", () => {
  const r = assessProfile({ ...base, bio: "Send money to my UPI, then whatsapp me on +91 98765 43210 for investment" });
  const codes = r.flags.map((f) => f.code);
  assert.ok(codes.includes("financial_solicitation")); assert.ok(codes.includes("contact_info_in_text"));
  assert.ok(r.score >= 60);
  assert.equal(r.approval_status, undefined); // output is advisory data only
});
test("age mismatch in text flagged", () => {
  assert.ok(assessProfile({ ...base, bio: "I am 19 and looking for someone kind" }).flags.some((f) => f.code === "age_text_mismatch"));
});
test("incomplete profile flagged low", () => {
  const r = assessProfile({ ...base, bio: "hi", job_title: null });
  assert.ok(r.flags.some((f) => f.code === "incomplete_profile")); assert.ok(r.score < 20);
});
test("redact removes contact details before any external call", () => {
  const out = redact("mail me a@b.com or call +91 98765 43210 or see https://x.io/p");
  assert.ok(!/a@b\.com|98765|https/.test(out));
});
test("external review is disabled by default and sends nothing", async () => {
  const { reviewProfile } = require("../src/lib/moderation-ai");
  const r = await reviewProfile(base);
  assert.equal(r.source, "rules");
});
