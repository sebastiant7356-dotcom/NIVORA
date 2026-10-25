"use strict";
function makeRouter() {
  const r = { routes: [], mws: [] };
  for (const m of ["get", "post", "put", "delete"]) r[m] = (p, ...h) => { r.routes.push({ method: m.toUpperCase(), path: p, handlers: h }); return r; };
  r.use = (...h) => { r.mws.push(...h); return r; };
  return r;
}
function express() {
  const app = makeRouter();
  app.disable = () => app; app.set = () => app; app.listen = () => {};
  return app;
}
express.Router = makeRouter;
express.json = () => (req, res, next) => next();
express.raw = () => (req, res, next) => next();
module.exports = express;
