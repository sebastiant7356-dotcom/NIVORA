"use strict";
/** Scripted fake Supabase client. Set globalThis.__fakeDb = (call) => ({data, error, count}) per test. */
function chain(table) {
  const call = { table, ops: [], single: false };
  const q = new Proxy(function () {}, {
    get(_, prop) {
      if (prop === "then") {
        const out = Promise.resolve((globalThis.__fakeDb || (() => ({ data: null, error: null })))(call));
        return out.then.bind(out);
      }
      return (...args) => {
        call.ops.push([prop, ...args]);
        if (prop === "maybeSingle" || prop === "single") call.single = true;
        return q;
      };
    }
  });
  return q;
}
function createClient() {
  return {
    from: (t) => chain(t),
    rpc: (name, args) => chain("rpc:" + name).rpcCall(name, args),
    auth: {
      getUser: async (token) => (globalThis.__fakeAuth ? globalThis.__fakeAuth(token) : { data: { user: null }, error: { message: "no" } }),
      admin: { deleteUser: async () => ({ error: null }) }
    }
  };
}
// rpc needs its own entry to carry the function name/args to the fake db
const origCreate = createClient;
module.exports = {
  createClient() {
    const c = origCreate();
    c.rpc = (name, args) => Promise.resolve((globalThis.__fakeDb || (() => ({ data: null, error: null })))({ table: "rpc:" + name, rpc: name, args, ops: [] }));
    return c;
  }
};
