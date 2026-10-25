"use strict";
// Replaces express / cors / @supabase/supabase-js with tiny in-memory stubs so route logic can be unit-tested
// without network or installed dependencies. These are STUBS: they do not prove real Express/Supabase behaviour.
const Module = require("node:module");
const path = require("node:path");

const stubs = {
  express: path.join(__dirname, "express.js"),
  cors: path.join(__dirname, "cors.js"),
  "@supabase/supabase-js": path.join(__dirname, "supabase.js")
};
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (stubs[request]) return stubs[request];
  return orig.call(this, request, ...rest);
};
