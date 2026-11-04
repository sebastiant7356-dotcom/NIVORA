"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { shakeRevealState } = require("../src/lib/shake-reveal");

const USER = "11111111-1111-4111-8111-111111111111";
const PARTNER = "22222222-2222-4222-8222-222222222222";

test("Shake identity stays hidden until both members consent", () => {
  const match = { match_source: "shake" };
  assert.deepEqual(shakeRevealState(match, USER, PARTNER, []), {
    is_shake_match: true, my_consented: false, partner_consented: false, revealed: false
  });
  assert.equal(shakeRevealState(match, USER, PARTNER, [{ user_id: USER }]).revealed, false);
  assert.equal(shakeRevealState(match, USER, PARTNER, [{ user_id: PARTNER }]).revealed, false);
  assert.deepEqual(shakeRevealState(match, USER, PARTNER, [{ user_id: USER }, { user_id: PARTNER }]), {
    is_shake_match: true, my_consented: true, partner_consented: true, revealed: true
  });
});

test("Daily matches retain their existing profile visibility", () => {
  assert.deepEqual(shakeRevealState({ match_source: "daily" }, USER, PARTNER, []), {
    is_shake_match: false, my_consented: false, partner_consented: false, revealed: true
  });
});
