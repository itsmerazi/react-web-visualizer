// Pure functions: no network, no React, so they can be unit-tested.
export const SCHEMA_VERSION = 1;
const FIELDS = ['throttle', 'steer', 'x', 'y', 'heading', 'left', 'right'];

// Returns { seq, correlationId, state } or null for anything that is not a v1 snapshot.
export function parseSnapshot(text) {
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return null;
  }
  if (!msg || msg.schema_version !== SCHEMA_VERSION || !Number.isInteger(msg.seq)) return null;
  const s = msg.state;
  if (!s || !FIELDS.every((key) => Number.isFinite(s[key]))) return null;
  return { seq: msg.seq, correlationId: msg.correlation_id ?? null, state: s };
}

// Counts snapshots lost on the way and spots engine restarts (seq starts again at 1).
export function createSeqTracker() {
  let last = null;
  const stats = { received: 0, dropped: 0, restarts: 0, repeats: 0 };
  return {
    stats,
    accept(seq) {
      if (last !== null && seq === last) {
        stats.repeats += 1;               // same snapshot again: ignore it
        return false;
      }
      if (last !== null && seq < last) stats.restarts += 1;   // engine restarted
      else if (last !== null) stats.dropped += seq - last - 1;
      last = seq;
      stats.received += 1;
      return true;
    },
  };
}