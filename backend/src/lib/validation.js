"use strict";

const VALUES = ["music", "movies", "gaming", "sports", "travel", "food", "art", "books", "technology", "fitness", "nature", "languages", "photography", "culture", "learning"];
const REVIEW_FIELDS = ["full_name", "age", "district", "job_title", "bio"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// eslint-disable-next-line no-control-regex
const clean = (s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").trim();

function str(body, key, { min = 0, max, required = false, label }) {
  if (!has(body, key) || body[key] === null || body[key] === undefined) {
    return required ? { error: `${label} is required.` } : { skip: true };
  }
  if (typeof body[key] !== "string") return { error: `${label} must be text.` };
  const v = clean(body[key]);
  if (v.length === 0 && !required && min === 0) return { value: null };
  if (v.length < min) return { error: `${label} must be at least ${min} characters.` };
  if (v.length > max) return { error: `${label} must be at most ${max} characters.` };
  return { value: v };
}

/** Validate a global adult social profile. Client-supplied roles and status are ignored. */
function parseProfileInput(body, { create }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body." };
  const out = {};
  const fail = (error) => ({ error });
  const rules = [
    ["full_name", { min: 2, max: 100, required: create, label: "Name" }],
    ["district", { max: 120, required: create, min: create ? 2 : 0, label: "City / region / country" }],
    ["job_title", { max: 100, label: "Work / study" }],
    ["bio", { max: 1000, label: "About you" }]
  ];
  for (const [key, rule] of rules) {
    const r = str(body, key, rule);
    if (r.error) return fail(r.error);
    if (!r.skip) out[key] = r.value;
  }

  if (create || has(body, "age")) {
    const age = typeof body.age === "string" && /^\d+$/.test(body.age) ? Number(body.age) : body.age;
    if (!Number.isInteger(age) || age < 18 || age > 100) return fail("Age must be 18 or older.");
    out.age = age;
  }

  if (create || has(body, "core_values")) {
    const values = body.core_values;
    if (!Array.isArray(values) || values.length < 1 || values.length > 5 ||
        new Set(values).size !== values.length || !values.every((value) => VALUES.includes(value))) {
      return fail("Choose between 1 and 5 interests from the list.");
    }
    out.core_values = values;
  }

  if (create) {
    const c = body.consents;
    if (!c || c.terms !== true || c.privacy !== true) {
      return fail("You must accept both the terms and the privacy & safety notice.");
    }
  }

  if (!create && Object.keys(out).length === 0) return fail("Provide at least one editable profile field.");
  return { value: out };
}

function needsReview(updates) {
  return REVIEW_FIELDS.some((field) => has(updates, field));
}

function isUuid(value) { return typeof value === "string" && UUID_RE.test(value); }
function firstName(fullName) { return String(fullName || "").trim().split(/\s+/)[0] || ""; }

module.exports = { VALUES, REVIEW_FIELDS, parseProfileInput, needsReview, isUuid, firstName, clean };
