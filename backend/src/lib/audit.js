"use strict";
const { serviceClient } = require("./clients");

/** Append-only audit trail. Never include tokens, OTPs, phone numbers or message bodies in details. */
async function audit(actorId, action, targetType, targetId, details = {}) {
  try {
    await serviceClient().from("audit_log").insert({
      actor_id: actorId || null, action, target_type: targetType || null,
      target_id: targetId ? String(targetId) : null, details
    });
  } catch {
    console.error("audit_log write failed for action:", action);
  }
}

module.exports = { audit };
