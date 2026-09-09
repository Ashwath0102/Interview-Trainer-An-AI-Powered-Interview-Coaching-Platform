/**
 * Lightweight in-memory response cache.
 *
 * Stores question-generation and evaluation results so that identical
 * requests skip the RAG retrieval and Granite generation steps entirely.
 *
 * - Backend: plain JavaScript Map (no external dependencies)
 * - TTL: 30 minutes per entry
 * - Singleton: module-level instance, persists for the process lifetime
 */

const TTL_MS = 30 * 60 * 1000; // 30 minutes

class ResponseCache {
  constructor() {
    this._store = new Map();
  }

  /**
   * Normalize and join parts into a stable cache key.
   * Lowercases, trims, collapses internal whitespace, then joins with "|".
   * @param {...string} parts
   * @returns {string}
   */
  buildKey(...parts) {
    return parts
      .map((p) => String(p ?? "").toLowerCase().trim().replace(/\s+/g, " "))
      .join("|");
  }

  /**
   * Retrieve a cached value.
   * Returns null if the key is absent or the entry has expired.
   * @param {string} key
   * @returns {*|null}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > TTL_MS) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Store a value under the given key with the current timestamp.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    this._store.set(key, { value, timestamp: Date.now() });
  }
}

// Singleton — one shared instance for the lifetime of the Node.js process.
module.exports = new ResponseCache();
