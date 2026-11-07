"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { EphemeralStore } = require("../src/lib/ephemeral-store");

test("stores values only until their TTL expires", () => {
  let now = 1000;
  const store = new EphemeralStore({ defaultTtlMs: 50, now: () => now });
  store.set("session:user-1", { online: true });
  assert.deepEqual(store.get("session:user-1"), { online: true });
  now = 1050;
  assert.equal(store.get("session:user-1"), undefined);
  assert.equal(store.size, 0);
});

test("isolates stored values from caller mutation", () => {
  const store = new EphemeralStore();
  const value = { profile: { displayName: "Anonymous" } };
  store.set("user-1", value);
  value.profile.displayName = "Changed";
  const read = store.get("user-1");
  assert.equal(read.profile.displayName, "Anonymous");
  read.profile.displayName = "Also changed";
  assert.equal(store.get("user-1").profile.displayName, "Anonymous");
});

test("enforces capacity by evicting the oldest entry", () => {
  const store = new EphemeralStore({ maxEntries: 2 });
  store.set("first", 1);
  store.set("second", 2);
  store.set("third", 3);
  assert.equal(store.get("first"), undefined);
  assert.equal(store.get("second"), 2);
  assert.equal(store.get("third"), 3);
});

test("supports user-scoped cleanup and explicit clearing", () => {
  const store = new EphemeralStore();
  store.set("profile:a", { userId: "a" });
  store.set("chat:a:b", { members: ["a", "b"] });
  assert.equal(store.deleteWhere((value) => value.userId === "a" || value.members?.includes("a")), 2);
  assert.equal(store.size, 0);
  store.set("one", 1);
  store.clear();
  assert.equal(store.size, 0);
});

test("rejects invalid keys and TTL values", () => {
  const store = new EphemeralStore();
  assert.throws(() => store.set("", 1), TypeError);
  assert.throws(() => store.set("ok", 1, 0), TypeError);
});
