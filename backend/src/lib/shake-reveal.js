"use strict";

function shakeRevealState(match, userId, partnerId, consentRows = []) {
  if (match?.match_source !== "shake") {
    return { is_shake_match: false, my_consented: false, partner_consented: false, revealed: true };
  }
  const consented = new Set((consentRows || []).map((row) => row.user_id));
  const myConsented = consented.has(userId);
  const partnerConsented = consented.has(partnerId);
  return {
    is_shake_match: true,
    my_consented: myConsented,
    partner_consented: partnerConsented,
    revealed: myConsented && partnerConsented
  };
}

module.exports = { shakeRevealState };
