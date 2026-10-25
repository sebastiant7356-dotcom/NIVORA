"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseProfileInput, needsReview, isUuid, firstName } = require("../src/lib/validation");

const good = () => ({
  full_name: "Ananya Nair", age: 26, district: "Kochi", gender: "woman", job_title: "Designer", bio: "I like books and long walks by the sea.",
  looking_for: "man", relationship_intention: "marriage", core_values: ["family", "kindness"],
  min_partner_age: 24, max_partner_age: 32, consents: { terms: true, privacy: true }
});

test("valid create payload passes and ignores unknown/privileged fields", () => {
  const r = parseProfileInput({ ...good(), approval_status: "approved", id: "x", role: "admin", is_active: false }, { create: true });
  assert.ok(r.value);
  assert.equal(r.value.approval_status, undefined);
  assert.equal(r.value.id, undefined);
  assert.equal(r.value.role, undefined);
  assert.equal(r.value.is_active, undefined);
});
test("age outside 21-40 rejected", () => {
  for (const age of [20, 41, 25.5, "abc", null, undefined]) assert.ok(parseProfileInput({ ...good(), age }, { create: true }).error, String(age));
});
test("consents are mandatory on create", () => {
  assert.ok(parseProfileInput({ ...good(), consents: { terms: true } }, { create: true }).error);
  const g = good(); delete g.consents;
  assert.ok(parseProfileInput(g, { create: true }).error);
});
test("values: 1..3, unique, from allow-list", () => {
  for (const core_values of [[], ["family", "kindness", "career", "faith"], ["family", "family"], ["hacking"], "family"]) {
    assert.ok(parseProfileInput({ ...good(), core_values }, { create: true }).error);
  }
});
test("partner age range validated", () => {
  assert.ok(parseProfileInput({ ...good(), min_partner_age: 35, max_partner_age: 30 }, { create: true }).error);
  assert.ok(parseProfileInput({ ...good(), min_partner_age: 18 }, { create: true }).error);
  const r = parseProfileInput({ ...good(), min_partner_age: undefined, max_partner_age: undefined }, { create: true });
  assert.equal(r.value.min_partner_age, 21); assert.equal(r.value.max_partner_age, 40);
});
test("enums and lengths enforced", () => {
  assert.ok(parseProfileInput({ ...good(), gender: "robot" }, { create: true }).error);
  assert.ok(parseProfileInput({ ...good(), bio: "x".repeat(1001) }, { create: true }).error);
  assert.ok(parseProfileInput({ ...good(), full_name: "A" }, { create: true }).error);
  assert.ok(parseProfileInput({ ...good(), full_name: 123 }, { create: true }).error);
});
test("control characters are stripped", () => {
  const r = parseProfileInput({ ...good(), full_name: "Ana\u0000nya" }, { create: true });
  assert.equal(r.value.full_name, "Ananya");
});
test("update: partial ok, empty rejected, status never accepted", () => {
  assert.ok(parseProfileInput({ bio: "hello there friend" }, { create: false }).value);
  assert.ok(parseProfileInput({}, { create: false }).error);
  assert.ok(parseProfileInput({ approval_status: "approved" }, { create: false }).error); // nothing editable -> error
});
test("needsReview only for identity/content fields", () => {
  assert.equal(needsReview({ bio: "x" }), true);
  assert.equal(needsReview({ looking_for: "any", min_partner_age: 22 }), false);
});
test("helpers", () => {
  assert.equal(isUuid("123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(isUuid("1; drop table"), false);
  assert.equal(firstName("  Ananya   Nair "), "Ananya");
});
