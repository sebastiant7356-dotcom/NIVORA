"use strict";

/**
 * Small in-memory fixed-window rate limiter (per process).
 * For multiple backend instances, replace the store with Redis.
 */
function createLimiter({ windowMs, max, keyFn, message = "Too many requests. Please slow down and try again shortly." }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, Math.min(windowMs, 60_000));
  timer.unref();

  const middleware = (req, res, next) => {
    const key = (keyFn ? keyFn(req) : req.ip) || "anon";
    const now = Date.now();
    let e = hits.get(key);
    if (!e || e.reset <= now) { e = { count: 0, reset: now + windowMs }; hits.set(key, e); }
    e.count += 1;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - e.count)));
    if (e.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((e.reset - now) / 1000)));
      return res.status(429).json({ success: false, message });
    }
    return next();
  };
  middleware._hits = hits;
  return middleware;
}

const byUser = (req) => (req.user ? `u:${req.user.id}` : `ip:${req.ip}`);

module.exports = { createLimiter, byUser };
