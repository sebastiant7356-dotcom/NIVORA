"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "src");
const api = fs.readFileSync(path.join(root, "routes", "ephemeral-api.js"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

test("minimal-data API has no Supabase table or Storage access", () => {
  assert.doesNotMatch(api, /\.from\s*\(/);
  assert.doesNotMatch(api, /\.storage\s*\./);
  assert.doesNotMatch(api, /\.rpc\s*\(/);
});

test("server mounts the ephemeral API and does not mount legacy content routes", () => {
  assert.match(server, /app\.use\("\/api",\s*require\("\.\/routes\/ephemeral-api"\)\)/);
  for (const route of ["profile", "match", "shake", "friends", "community", "chat", "safety", "account", "admin"]) {
    assert.doesNotMatch(server, new RegExp('require\\("\.\\/routes\\/' + route + '"\\)'));
  }
  assert.doesNotMatch(server, /routes\/profile-photos/);
});

test("minimal-data API retains no member content after process restart by design", () => {
  assert.match(api, /new EphemeralStore/);
  assert.match(api, /12 \* 60 \* 60 \* 1000/);
  assert.match(api, /volatile process memory/i);
});
