"use strict";

/**
 * Process-local, TTL-bound state for BEYOND's non-persistent social sessions.
 *
 * IMPORTANT: This store is intentionally volatile. It is cleared when the
 * backend process restarts and must never be treated as a source of durable
 * account, moderation, billing, or legal records. Do not put credentials,
 * access tokens, or Google provider secrets in it.
 *
 * Render is currently configured for one backend instance. If the service is
 * scaled to multiple instances, replace this adapter with a shared ephemeral
 * presence/realtime store before enabling cross-instance discovery.
 */
class EphemeralStore {
  constructor({ defaultTtlMs = 30 * 60 * 1000, maxEntries = 10_000, now = Date.now } = {}) {
    if (!Number.isFinite(defaultTtlMs) || defaultTtlMs <= 0) throw new TypeError("defaultTtlMs must be positive.");
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new TypeError("maxEntries must be a positive integer.");
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.items = new Map();
  }

  _purgeExpired() {
    const now = this.now();
    for (const [key, item] of this.items) {
      if (item.expiresAt <= now) this.items.delete(key);
    }
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (typeof key !== "string" || !key || key.length > 256) throw new TypeError("A non-empty key up to 256 characters is required.");
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new TypeError("ttlMs must be positive.");
    this._purgeExpired();
    if (!this.items.has(key) && this.items.size >= this.maxEntries) {
      const oldestKey = this.items.keys().next().value;
      if (oldestKey !== undefined) this.items.delete(oldestKey);
    }
    this.items.delete(key);
    this.items.set(key, { value: structuredClone(value), expiresAt: this.now() + ttlMs });
    return true;
  }

  get(key) {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= this.now()) {
      this.items.delete(key);
      return undefined;
    }
    return structuredClone(item.value);
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    return this.items.delete(key);
  }

  deleteWhere(predicate) {
    if (typeof predicate !== "function") throw new TypeError("predicate must be a function.");
    let deleted = 0;
    for (const [key, item] of this.items) {
      if (item.expiresAt <= this.now() || predicate(structuredClone(item.value), key)) {
        this.items.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  entries() {
    this._purgeExpired();
    return Array.from(this.items, ([key, item]) => [key, structuredClone(item.value)]);
  }

  clear() {
    this.items.clear();
  }

  get size() {
    this._purgeExpired();
    return this.items.size;
  }
}

module.exports = { EphemeralStore };
