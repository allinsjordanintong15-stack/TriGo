/// <reference types="node" />

// New-request vibration helpers (src/utils/newRequestAlert.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  findNewRequestKeys,
  isUnexpired,
  outOfAreaRequestKey,
  standardRequestKey,
} from '../../src/utils/newRequestAlert.ts';

describe('findNewRequestKeys', () => {
  it('alerts nothing on the baseline snapshot', () => {
    assert.deepEqual(findNewRequestKeys(new Set(), ['booking:a', 'booking:b'], true), []);
  });

  it('returns only keys not seen before', () => {
    const seen = new Set(['booking:a']);
    assert.deepEqual(findNewRequestKeys(seen, ['booking:a', 'booking:b'], false), ['booking:b']);
  });

  it('returns each new key once', () => {
    assert.deepEqual(findNewRequestKeys(new Set(), ['request:x', 'request:x'], false), ['request:x']);
  });

  it('returns nothing when every request was already seen (once per request)', () => {
    const seen = new Set(['booking:a', 'request:x']);
    assert.deepEqual(findNewRequestKeys(seen, ['request:x', 'booking:a'], false), []);
  });
});

describe('request keys', () => {
  it('keeps a booking and an out-of-area request with the same ID apart', () => {
    assert.notEqual(standardRequestKey('abc'), outOfAreaRequestKey('abc'));
  });
});

describe('isUnexpired', () => {
  const now = Date.UTC(2026, 10, 1, 10, 0, 0);

  it('is true only before expiresAt', () => {
    assert.equal(isUnexpired(new Date(now + 1000), now), true);
    assert.equal(isUnexpired(new Date(now), now), false);
    assert.equal(isUnexpired(new Date(now - 1000), now), false);
  });

  it('treats a missing expiry as expired', () => {
    assert.equal(isUnexpired(null, now), false);
  });
});
