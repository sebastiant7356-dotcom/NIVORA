"use strict";
const { createClient } = require("@supabase/supabase-js");
const config = require("../config");

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

let service;
/** Service-role client. SERVER-SIDE ONLY. Bypasses RLS: callers must authorise in code first. */
function serviceClient() {
  if (!service) service = createClient(config.supabaseUrl, config.serviceKey, opts);
  return service;
}

let anon;
/** Used only to verify a user's access token with Supabase Auth. */
function anonClient() {
  if (!anon) anon = createClient(config.supabaseUrl, config.anonKey, opts);
  return anon;
}

module.exports = { serviceClient, anonClient };
