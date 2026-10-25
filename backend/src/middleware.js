"use strict";
const cors = require("cors");
const config = require("./config");
const { anonClient, serviceClient } = require("./lib/clients");

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (config.isProd) res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  next();
}

function corsMiddleware() {
  const dev = !config.isProd;
  return cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl / server-to-server (webhooks)
      if (config.allowedOrigins.includes(origin)) return cb(null, true);
      if (dev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600
  });
}

// Logs method/path/status only — never headers, bodies, tokens, OTPs or phone numbers.
function requestLogger(req, res, next) {
  const t0 = Date.now();
  res.on("finish", () => {
    const path = req.originalUrl.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id");
    console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - t0}ms`);
  });
  next();
}

/** Verifies the Supabase access token with Supabase Auth and requires a phone-verified account. */
async function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return res.status(401).json({ success: false, message: "Login required." });
  try {
    const { data, error } = await anonClient().auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ success: false, message: "Invalid or expired login session." });
    }
    const u = data.user;
    if (!u.phone || !u.phone_confirmed_at) {
      return res.status(403).json({ success: false, message: "A phone-verified account is required. Please sign in with your phone number and OTP." });
    }
    req.user = { id: u.id }; // immutable id only; phone is never copied into request logs
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Unable to verify login." });
  }
}

/** Role is looked up in staff_roles on the server. Nothing the client sends is trusted. */
function requireStaff(...roles) {
  return async (req, res, next) => {
    const { data, error } = await serviceClient()
      .from("staff_roles").select("role").eq("user_id", req.user.id).maybeSingle();
    if (error) return res.status(500).json({ success: false, message: "Could not verify staff access." });
    if (!data || (roles.length && !roles.includes(data.role))) {
      return res.status(403).json({ success: false, message: "Not authorised." });
    }
    req.staffRole = data.role;
    return next();
  };
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: "Not found." });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.type === "entity.too.large") return res.status(413).json({ success: false, message: "Request too large." });
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ success: false, message: "Invalid JSON." });
  console.error("Unhandled error:", err && err.code ? err.code : err && err.message ? err.message : "unknown");
  res.status(500).json({ success: false, message: "Unexpected server error." });
}

module.exports = { securityHeaders, corsMiddleware, requestLogger, requireAuth, requireStaff, notFound, errorHandler };
