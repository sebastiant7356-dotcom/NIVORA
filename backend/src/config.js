"use strict";
try { require("dotenv").config(); } catch { /* dotenv optional: real environment variables still work */ }

const env = process.env;
const bool = (v, d = false) => (v === undefined || v === "" ? d : ["1", "true", "yes"].includes(String(v).toLowerCase()));

const config = {
  isProd: env.NODE_ENV === "production",
  port: Number(env.PORT) || 4000,
  trustProxy: env.TRUST_PROXY || "0",
  supabaseUrl: env.SUPABASE_URL || "",
  anonKey: env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "",
  serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || "",
  allowedOrigins: (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  policyVersion: env.CONSENT_POLICY_VERSION || "unversioned",
  payment: {
    amountPaise: Number(env.PAYMENT_AMOUNT_PAISE) || 5000,
    required: bool(env.PAYMENT_REQUIRED, false),
    keyId: env.RAZORPAY_KEY_ID || "",
    keySecret: env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || ""
  },
  iceServersJson: env.ICE_SERVERS_JSON || "",
  ai: {
    externalEnabled: bool(env.AI_EXTERNAL_ENABLED, false),
    apiKey: env.ANTHROPIC_API_KEY || "",
    model: env.AI_MODEL || "claude-haiku-5-5"
  }
};
config.payment.enabled = Boolean(config.payment.keyId && config.payment.keySecret);

// Classify a Supabase API key WITHOUT ever logging the key itself. Supabase has two key
// formats: the newer "sb_publishable_..." / "sb_secret_..." keys, and the older JWTs
// ("eyJ...", 3 dot-separated parts, with a decodable "role" claim). Either way this proves
// which *kind* of key ended up in each env var, which is exactly what a copy-paste mix-up
// (service key and publishable key swapped) would reveal.
function classifyKey(key) {
  if (!key) return "EMPTY (env var not set, or empty string)";
  if (key.startsWith("sb_publishable_")) return `new-format PUBLISHABLE key (len ${key.length})`;
  if (key.startsWith("sb_secret_")) return `new-format SECRET key (len ${key.length})`;
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      return `legacy JWT, role claim: "${payload.role || "none"}" (len ${key.length})`;
    } catch {
      return `legacy-looking JWT but undecodable (len ${key.length})`;
    }
  }
  return `UNRECOGNISED format (len ${key.length}, starts "${key.slice(0, 4)}...")`;
}
config.serviceKeyRoleClaim = classifyKey(config.serviceKey);
config.anonKeyRoleClaim = classifyKey(config.anonKey);

// Names of missing REQUIRED settings (never values).
config.missing = function missing() {
  const m = [];
  if (!config.supabaseUrl) m.push("SUPABASE_URL");
  if (!config.anonKey) m.push("SUPABASE_PUBLISHABLE_KEY");
  if (!config.serviceKey) m.push("SUPABASE_SERVICE_ROLE_KEY");
  if (config.isProd && config.allowedOrigins.length === 0) m.push("ALLOWED_ORIGINS");
  if (config.payment.required && !config.payment.enabled) m.push("RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET (PAYMENT_REQUIRED=true)");
  return m;
};

module.exports = config;
