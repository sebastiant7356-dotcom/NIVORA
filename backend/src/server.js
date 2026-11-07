"use strict";
const express = require("express");
const path = require("node:path");
const config = require("./config");
const mw = require("./middleware");
const { createLimiter } = require("./lib/ratelimit");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy === "0" ? false : (/^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy));

  app.use(mw.requestLogger);
  app.use(mw.securityHeaders);
  app.use(mw.corsMiddleware());

  app.use("/api", createLimiter({ windowMs: 15 * 60_000, max: 600 }));

  app.use(express.json({ limit: "20kb" }));

  app.get("/api/health", (req, res) => res.json({ success: true, app: "BEYOND", data_mode: "ephemeral", member_content_persistence: false, message: "Backend is running" }));

  // Public legal documents required by the Android app and Play Store listing.
  const legalFiles = new Set(["privacy.html", "terms.html", "styles.css"]);
  app.get("/privacy", (req, res) => res.redirect(302, "/legal/privacy.html"));
  app.get("/terms", (req, res) => res.redirect(302, "/legal/terms.html"));
  app.get("/legal/:file", (req, res, next) => {
    if (!legalFiles.has(req.params.file)) return next();
    res.sendFile(path.resolve(__dirname, "../legal", req.params.file));
  });

  // Public, non-secret runtime settings for the frontend.
  app.get("/api/config", (req, res) => res.json({
    success: true,
    policy_version: config.policyVersion,
    data_mode: "ephemeral",
    media_uploads_enabled: false,
    session_inactivity_hours: 12
  }));

  // Persistent safety moderation is deliberately mounted before the volatile member API.
  // It stores only reports, enforcement status and moderator audit actions.
  app.use("/api", require("./routes/moderation-api").router);

  // Minimal-data mode: all other member-generated content is handled by volatile memory.
  // Legacy Supabase content routes are not mounted.
  app.use("/api", require("./routes/ephemeral-api"));

  app.use(mw.notFound);
  app.use(mw.errorHandler);
  return app;
}

if (require.main === module) {
  const missing = config.missing();
  if (missing.length) {
    console.error("BEYOND backend cannot start. Missing required settings: " + missing.join(", "));
    console.error("Copy .env.example to .env and fill them in.");
    process.exit(1);
  }
  createApp().listen(config.port, "0.0.0.0", () => {
    console.log(`BEYOND backend running on port ${config.port} (${config.isProd ? "production" : "development"})`);
  });
}

module.exports = { createApp };
