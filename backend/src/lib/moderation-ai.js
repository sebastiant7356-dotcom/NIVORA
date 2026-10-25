"use strict";
const config = require("../config");

/**
 * AI-assisted moderation. OUTPUT IS ADVISORY ONLY: it is stored for staff to read
 * and never changes approval_status by itself.
 */

const RULES = [
  { code: "contact_info_in_text", severity: "medium", weight: 20,
    test: (t) => /(\+?\d[\d\s().-]{8,}\d)/.test(t) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) || /https?:\/\/|www\./i.test(t),
    detail: "Free text contains a phone number, email or link (off-platform contact)." },
  { code: "off_platform_handle", severity: "low", weight: 10,
    test: (t) => /\b(whats\s?app|telegram|instagram|insta|snapchat|signal)\b|@\w{3,}/i.test(t),
    detail: "Mentions another messaging platform or a social handle." },
  { code: "financial_solicitation", severity: "high", weight: 45,
    test: (t) => /\b(send money|bank account|upi|invest(ment)?|crypto|bitcoin|gift ?card|western union|loan|visa fee|customs fee|wire transfer|trading)\b/i.test(t),
    detail: "Mentions money transfer or investment — common in romance-scam profiles." },
  { code: "abusive_or_explicit", severity: "high", weight: 40,
    test: (t) => /\b(sex|nude|nudes|hookup|escort|one night|fuck|bitch|slut)\b/i.test(t),
    detail: "Contains explicit or abusive wording." },
  { code: "age_text_mismatch", severity: "high", weight: 35,
    test: (t, p) => {
      const m = t.match(/\b(?:i am|i'm|age[d]?:?)\s*(\d{2})\b/i);
      return Boolean(m && p.age && (Number(m[1]) < 21 || Math.abs(Number(m[1]) - p.age) > 2));
    },
    detail: "Age mentioned in text differs from the declared age or is under 21." }
];

function assessProfile(p) {
  const text = [p.bio, p.job_title, p.district].filter(Boolean).join(" \n ");
  const flags = [];
  for (const r of RULES) {
    if (r.test(text, p)) flags.push({ code: r.code, severity: r.severity, detail: r.detail, source: "rules" });
  }
  const name = String(p.full_name || "");
  if (/\d|[_@#$%^&*=+<>]/.test(name) || /(.)\1{3,}/.test(name) || name.trim().split(/\s+/).length === 0) {
    flags.push({ code: "suspicious_name", severity: "medium", detail: "Name contains digits, symbols or repeated characters.", source: "rules" });
  }
  if (!p.bio || p.bio.length < 20) {
    flags.push({ code: "incomplete_profile", severity: "low", detail: "About-you text is missing or very short.", source: "rules" });
  }
  if (!p.job_title) {
    flags.push({ code: "missing_work_study", severity: "low", detail: "Work/study not provided.", source: "rules" });
  }
  const weights = { low: 5, medium: 20, high: 40 };
  const score = Math.min(100, flags.reduce((s, f) => s + (RULES.find((r) => r.code === f.code)?.weight ?? weights[f.severity]), 0));
  return { score, flags, source: "rules" };
}

function redact(s) {
  return String(s || "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[link]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[number]")
    .slice(0, 1000);
}

/** Optional external review. Sends ONLY redacted bio + job title. Disabled unless explicitly enabled. */
async function externalReview(p, fetchImpl = fetch) {
  if (!config.ai.externalEnabled || !config.ai.apiKey) return null;
  try {
    const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": config.ai.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: config.ai.model,
        max_tokens: 300,
        system: "You screen dating-profile text for a staff reviewer. Reply ONLY with JSON: {\"flags\":[{\"code\":\"scam|abuse|explicit|underage|spam|other\",\"detail\":\"short reason\"}]}. Return {\"flags\":[]} if nothing concerning. Your output is advisory; a human decides.",
        messages: [{ role: "user", content: `Work/study: ${redact(p.job_title)}\nAbout: ${redact(p.bio)}` }]
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content || []).map((c) => c.text || "").join("");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    if (!Array.isArray(parsed.flags)) return null;
    return parsed.flags.slice(0, 5).map((f) => ({
      code: `llm_${String(f.code || "other").replace(/[^a-z_]/gi, "").slice(0, 20)}`,
      severity: "medium",
      detail: String(f.detail || "").slice(0, 200),
      source: "llm"
    }));
  } catch {
    return null; // never block profile saving on an advisory service
  }
}

async function reviewProfile(p) {
  const base = assessProfile(p);
  const ext = await externalReview(p);
  if (ext && ext.length) {
    base.flags.push(...ext);
    base.score = Math.min(100, base.score + 15 * ext.length);
    base.source = "rules+llm";
  }
  return base;
}

module.exports = { assessProfile, reviewProfile, redact };
