"use strict";
const { serviceClient } = require("./clients");

/** Append-only audit trail. Never include tokens, OTPs, phone numbers or message bodies in details. */
async function audit(actorId, action, targetType, targetId, details = {}) {
  try {
    const { error } = await serviceClient().from("audit_log").insert({
      actor_id: actorId || null, action, target_type: targetType || null,
      target_id: targetId ? String(targetId) : null, details
    });
    if (error) {
      console.error("audit_log write failed for action:", action);
      return false;
    }
    return true;
  } catch {
    console.error("audit_log write failed for action:", action);
    return false;
  }
}

module.exports = { audit };
