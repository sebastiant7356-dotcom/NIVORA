"use strict";
const express = require("express");
const config = require("./config");
const mw = require("./middleware");
const { createLimiter } = require("./lib/ratelimit");

// DIAGNOSTIC (safe to keep briefly, remove once resolved): proves which Postgres role each
// configured Supabase key actually carries, without ever printing the key itself.
console.log(`[DIAG] SUPABASE_SERVICE_ROLE_KEY decodes to role: "${config.serviceKeyRoleClaim}" (expected "service_role")`);
console.log(`[DIAG] SUPABASE_PUBLISHABLE_KEY decodes to role: "${config.anonKeyRoleClaim}" (expected "anon")`);

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy === "0" ? false : (/^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy));

  app.use(mw.requestLogger);
  app.use(mw.securityHeaders);
  app.use(mw.corsMiddleware());

  // Webhook needs the RAW body for signature verification, so it is mounted before express.json().
  const payments = require("./routes/payments");
  app.post("/api/payments/webhook", express.raw({ type: "*/*", limit: "100kb" }), payments.webhookHandler);

  app.use(express.json({ limit: "20kb" }));
  app.use("/api", createLimiter({ windowMs: 15 * 60_000, max: 600 }));

  app.get("/api/health", (req, res) => res.json({ success: true, app: "NIVORA", message: "Backend is running" }));

  // Public, non-secret runtime settings for the frontend.
  app.get("/api/config", (req, res) => res.json({
    success: true,
    payment: { enabled: config.payment.enabled, required: config.payment.required, amount_paise: config.payment.amountPaise },
    policy_version: config.policyVersion
  }));

  app.use("/api/profile", require("./routes/profile"));
  app.use("/api/match", require("./routes/match"));
  app.use("/api/chat", require("./routes/chat"));
  app.use("/api/call", require("./routes/call"));
  app.use("/api/safety", require("./routes/safety"));
  app.use("/api/feedback", require("./routes/feedback"));
  app.use("/api/payments", payments.router);
  app.use("/api/account", require("./routes/account"));
  app.use("/api/admin", require("./routes/admin"));

  app.use(mw.notFound);
  app.use(mw.errorHandler);
  return app;
}

if (require.main === module) {
  const missing = config.missing();
  if (missing.length) {
    console.error("NIVORA backend cannot start. Missing required settings: " + missing.join(", "));
    console.error("Copy .env.example to .env and fill them in.");
    process.exit(1);
  }
  createApp().listen(config.port, "0.0.0.0", () => {
    console.log(`NIVORA backend running on port ${config.port} (${config.isProd ? "production" : "development"})`);
    if (!config.payment.enabled) console.log("Payments: disabled (Razorpay keys not set)");
  });
}

module.exports = { createApp };
