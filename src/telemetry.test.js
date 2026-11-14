import { describe, expect, it } from 'vitest';
import { createSeqTracker, parseSnapshot } from './telemetry.js';

const state = { throttle: 0.5, steer: 0, x: 1, y: 2, heading: 0.1, left: 0.5, right: 0.5 };
const msg = (extra = {}) => JSON.stringify({ schema_version: 1, seq: 7, correlation_id: null, state, ...extra });

describe('parseSnapshot', () => {
  it('accepts a v1 snapshot', () => {
    expect(parseSnapshot(msg({ correlation_id: 'abc' }))).toEqual({ seq: 7, correlationId: 'abc', state });
  });
  it('refuses text that is not a v1 snapshot', () => {
    expect(parseSnapshot('{"test":1}')).toBeNull();
    expect(parseSnapshot('not json')).toBeNull();
    expect(parseSnapshot(msg({ schema_version: 2 }))).toBeNull();
    expect(parseSnapshot(msg({ state: { ...state, x: 'far' } }))).toBeNull();
  });
});

describe('createSeqTracker', () => {
  it('counts gaps, repeats and restarts', () => {
    const t = createSeqTracker();
    expect([1, 2, 5].map((s) => t.accept(s))).toEqual([true, true, true]);
    expect(t.stats.dropped).toBe(2);           // 3 and 4 never arrived
    expect(t.accept(5)).toBe(false);           // a repeat is ignored
    expect(t.accept(1)).toBe(true);            // seq went down: engine restarted
    expect(t.stats).toEqual({ received: 4, dropped: 2, restarts: 1, repeats: 1 });
  });
});