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

  // Private uploads use raw bodies and must be parsed before the JSON middleware.
  app.use("/api/profile/photos", express.raw({ type: "*/*", limit: "5mb" }), require("./routes/profile-photos"));
  app.use("/api/chat/:matchId/voice", express.raw({ type: "*/*", limit: "2mb" }));

  app.use(express.json({ limit: "20kb" }));

  app.get("/api/health", (req, res) => res.json({ success: true, app: "MELVO", message: "Backend is running" }));

  // Public legal documents required by the Android app and Play Store listing.
  const legalFiles = new Set(["privacy.html", "privacy_ml.html", "terms.html", "terms_ml.html", "styles.css"]);
  app.get("/privacy", (req, res) => res.redirect(302, "/legal/privacy.html"));
  app.get("/terms", (req, res) => res.redirect(302, "/legal/terms.html"));
  app.get("/legal/:file", (req, res, next) => {
    if (!legalFiles.has(req.params.file)) return next();
    res.sendFile(path.resolve(__dirname, "../legal", req.params.file));
  });

  // Public, non-secret runtime settings for the frontend.
  app.get("/api/config", (req, res) => res.json({
    success: true,
    policy_version: config.policyVersion
  }));

  app.use("/api/profile", require("./routes/profile"));
  app.use("/api/match", require("./routes/match"));
  app.use("/api/shake", require("./routes/shake"));
  app.use("/api/friends", require("./routes/friends"));
  app.use("/api/community", require("./routes/community"));
  app.use("/api/chat", require("./routes/chat"));
  app.use("/api/safety", require("./routes/safety"));
  app.use("/api/feedback", require("./routes/feedback"));
  app.use("/api/account", require("./routes/account"));
  app.use("/api/admin", require("./routes/admin"));

  app.use(mw.notFound);
  app.use(mw.errorHandler);
  return app;
}

if (require.main === module) {
  const missing = config.missing();
  if (missing.length) {
    console.error("MELVO backend cannot start. Missing required settings: " + missing.join(", "));
    console.error("Copy .env.example to .env and fill them in.");
    process.exit(1);
  }
  createApp().listen(config.port, "0.0.0.0", () => {
    console.log(`MELVO backend running on port ${config.port} (${config.isProd ? "production" : "development"})`);
  });
}

module.exports = { createApp };
