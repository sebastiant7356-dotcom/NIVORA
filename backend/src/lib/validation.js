"use strict";

const GENDERS = ["woman", "man", "other"];
const LOOKING_FOR = ["woman", "man", "any"];
const INTENTIONS = ["marriage", "longterm"];
const VALUES = ["family", "kindness", "career", "faith", "communication", "lifestyle"];
// Changing any of these sends an approved profile back to staff review.
const REVIEW_FIELDS = ["full_name", "age", "gender", "district", "job_title", "bio"];
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

/**
 * Validate profile input on the server. Never trusts client-supplied id/role/status.
 * @param {object} body
 * @param {{create:boolean}} opts  create=true => all core fields + consents required
 * @returns {{error?:string, value?:object}}
 */
function parseProfileInput(body, { create }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body." };
  const out = {};
  const fail = (error) => ({ error });

  const rules = [
    ["full_name", { min: 2, max: 100, required: create, label: "Name" }],
    ["district", { max: 100, required: create, min: create ? 2 : 0, label: "Location" }],
    ["job_title", { max: 100, label: "Work/study" }],
    ["bio", { max: 1000, label: "About you" }]
  ];
  for (const [key, rule] of rules) {
    const r = str(body, key, rule);
    if (r.error) return fail(r.error);
    if (!r.skip) out[key] = r.value;
  }

  if (create || has(body, "age")) {
    const age = typeof body.age === "string" && /^\d+$/.test(body.age) ? Number(body.age) : body.age;
    if (!Number.isInteger(age) || age < 21 || age > 40) return fail("Age must be between 21 and 40.");
    out.age = age;
  }

  const enums = [
    ["gender", GENDERS, "Gender"],
    ["looking_for", LOOKING_FOR, "Partner preference"],
    ["relationship_intention", INTENTIONS, "Relationship intention"]
  ];
  for (const [key, allowed, label] of enums) {
    if (create || has(body, key)) {
      if (typeof body[key] !== "string" || !allowed.includes(body[key])) return fail(`${label} is invalid.`);
      out[key] = body[key];
    }
  }

  if (create || has(body, "core_values")) {
    const v = body.core_values;
    if (!Array.isArray(v) || v.length < 1 || v.length > 3 ||
        new Set(v).size !== v.length || !v.every((x) => VALUES.includes(x))) {
      return fail("Choose between 1 and 3 values from the list.");
    }
    out.core_values = v;
  }

  if (create || has(body, "min_partner_age") || has(body, "max_partner_age")) {
    const toAge = (x, d) => (x === undefined || x === null || x === "" ? d : Number(x));
    const min = toAge(body.min_partner_age, 21);
    const max = toAge(body.max_partner_age, 40);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 21 || max > 40 || min > max) {
      return fail("Preferred age range must be within 21–40 and min must not exceed max.");
    }
    out.min_partner_age = min;
    out.max_partner_age = max;
  }

  if (create) {
    const c = body.consents;
    if (!c || c.terms !== true || c.privacy !== true) {
      return fail("You must accept both the terms/data-use consent and the privacy & safety notice.");
    }
  }

  if (!create && Object.keys(out).length === 0) return fail("Provide at least one editable profile field.");
  return { value: out };
}

function needsReview(updates) {
  return REVIEW_FIELDS.some((f) => has(updates, f));
}

function isUuid(v) { return typeof v === "string" && UUID_RE.test(v); }

function firstName(fullName) {
  return String(fullName || "").trim().split(/\s+/)[0] || "";
}

module.exports = {
  GENDERS, LOOKING_FOR, INTENTIONS, VALUES, REVIEW_FIELDS,
  parseProfileInput, needsReview, isUuid, firstName, clean
};
