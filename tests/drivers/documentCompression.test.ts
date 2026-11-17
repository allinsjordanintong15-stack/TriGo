/// <reference types="node" />

// Driver application document photos: which compression step is used
// (src/utils/documentCompression.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DOCUMENT_BASE64_MAX_LENGTH,
  DOCUMENT_COMPRESSION_STEPS,
  DOCUMENT_IMAGE_MAX_BYTES,
  DOCUMENT_IMAGE_TARGET_BYTES,
} from '../../src/constants/applicationDocuments.ts';
import {
  base64ByteLength,
  base64ToBytes,
  compressWithSteps,
  fitLongSide,
  type CompressionStep,
  type Dimensions,
} from '../../src/utils/documentCompression.ts';

const PHONE_PHOTO: Dimensions = { width: 4000, height: 3000 };

/** A fake encoder: returns the size given for each step and records the calls. */
function fakeEncoder(sizes: number[]) {
  const calls: { step: CompressionStep; size: Dimensions }[] = [];
  const encode = async (step: CompressionStep, size: Dimensions) => {
    calls.push({ step, size });
    return { ...size, sizeBytes: sizes[calls.length - 1] };
  };
  return { encode, calls };
}

describe('document compression steps', () => {
  it('match the spec: 1600 px at 0.7, quality down to 0.5, then 1280 px', () => {
    assert.deepEqual(DOCUMENT_COMPRESSION_STEPS, [
      { longSide: 1600, quality: 0.7 },
      { longSide: 1600, quality: 0.6 },
      { longSide: 1600, quality: 0.5 },
      { longSide: 1280, quality: 0.5 },
    ]);
    assert.equal(DOCUMENT_IMAGE_TARGET_BYTES, 600_000);
    assert.equal(DOCUMENT_IMAGE_MAX_BYTES, 700_000);
    assert.equal(DOCUMENT_BASE64_MAX_LENGTH, 950_000);
  });

  it('the largest photo fits the base64 limit and the 1 MiB document limit with headroom', () => {
    const largest = Buffer.alloc(DOCUMENT_IMAGE_MAX_BYTES).toString('base64');
    assert.equal(largest.length, 933_336);
    assert.ok(largest.length <= DOCUMENT_BASE64_MAX_LENGTH);
    // The rest of the photo document (uid, docType, mimeType, sizes, time) is under 1 KB.
    assert.ok(largest.length + 1_024 < 1_048_576 - 50_000);
  });
});

describe('fitLongSide', () => {
  it('scales the longest side down, keeping the aspect ratio', () => {
    assert.deepEqual(fitLongSide(PHONE_PHOTO, 1600), { width: 1600, height: 1200 });
    assert.deepEqual(fitLongSide({ width: 3000, height: 4000 }, 1280), { width: 960, height: 1280 });
    assert.deepEqual(fitLongSide({ width: 4032, height: 3024 }, 1600), { width: 1600, height: 1200 });
  });

  it('never enlarges a smaller photo', () => {
    assert.deepEqual(fitLongSide({ width: 1200, height: 900 }, 1600), { width: 1200, height: 900 });
    assert.deepEqual(fitLongSide({ width: 1600, height: 1600 }, 1600), { width: 1600, height: 1600 });
  });

  it('keeps at least 1 px on the short side', () => {
    assert.deepEqual(fitLongSide({ width: 10000, height: 2 }, 1600), { width: 1600, height: 1 });
  });
});

describe('compressWithSteps', () => {
  it('stops at the first step at or under 600 KB', async () => {
    const { encode, calls } = fakeEncoder([550_000]);
    const outcome = await compressWithSteps(encode, PHONE_PHOTO);
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.ok && outcome.step, { longSide: 1600, quality: 0.7 });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].size, { width: 1600, height: 1200 });
  });

  it('accepts exactly 600 KB', async () => {
    const { encode, calls } = fakeEncoder([600_000]);
    assert.equal((await compressWithSteps(encode, PHONE_PHOTO)).ok, true);
    assert.equal(calls.length, 1);
  });

  it('steps the quality down before the size', async () => {
    const { encode, calls } = fakeEncoder([800_000, 660_000, 590_000]);
    const outcome = await compressWithSteps(encode, PHONE_PHOTO);
    assert.deepEqual(outcome.ok && outcome.step, { longSide: 1600, quality: 0.5 });
    assert.deepEqual(
      calls.map((c) => c.step.quality),
      [0.7, 0.6, 0.5],
    );
  });

  it('drops the longest side to 1280 px last', async () => {
    const { encode, calls } = fakeEncoder([1_200_000, 1_000_000, 750_000, 500_000]);
    const outcome = await compressWithSteps(encode, PHONE_PHOTO);
    assert.deepEqual(outcome.ok && outcome.step, { longSide: 1280, quality: 0.5 });
    assert.deepEqual(calls[3].size, { width: 1280, height: 960 });
  });

  it('uses the smallest result when none reaches 600 KB but it is at most 700 KB', async () => {
    const { encode } = fakeEncoder([1_200_000, 1_000_000, 700_001, 700_000]);
    const outcome = await compressWithSteps(encode, PHONE_PHOTO);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.ok && outcome.image.sizeBytes, 700_000);
    assert.deepEqual(outcome.ok && outcome.step, { longSide: 1280, quality: 0.5 });
  });

  it('never returns a photo over 700 KB', async () => {
    const { encode, calls } = fakeEncoder([2_000_000, 1_500_000, 1_100_000, 700_001]);
    const outcome = await compressWithSteps(encode, PHONE_PHOTO);
    assert.deepEqual(outcome, { ok: false, reason: 'too-large', smallestBytes: 700_001 });
    assert.equal(calls.length, 4);
  });

  it('keeps a small photo at its own size', async () => {
    const { encode, calls } = fakeEncoder([120_000]);
    const outcome = await compressWithSteps(encode, { width: 800, height: 600 });
    assert.equal(outcome.ok && outcome.image.width, 800);
    assert.deepEqual(calls[0].size, { width: 800, height: 600 });
  });
});

describe('base64ByteLength', () => {
  it('counts decoded bytes, including padding', () => {
    assert.equal(base64ByteLength(''), 0);
    assert.equal(base64ByteLength(Buffer.from('a').toString('base64')), 1);
    assert.equal(base64ByteLength(Buffer.from('ab').toString('base64')), 2);
    assert.equal(base64ByteLength(Buffer.from('abc').toString('base64')), 3);
    const bytes = Buffer.alloc(654_321, 7);
    assert.equal(base64ByteLength(bytes.toString('base64')), 654_321);
  });

  it('ignores line breaks', () => {
    assert.equal(base64ByteLength('YWJj\nZGVm'), 6);
  });
});

describe('base64ToBytes', () => {
  it('decodes what Node encodes, for every padding length', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'abcd']) {
      const encoded = Buffer.from(text).toString('base64');
      assert.deepEqual(Buffer.from(base64ToBytes(encoded)), Buffer.from(text));
    }
  });

  it('decodes a 700 KB photo exactly, and its length matches base64ByteLength', () => {
    const photo = Buffer.alloc(DOCUMENT_IMAGE_MAX_BYTES);
    for (let i = 0; i < photo.length; i++) photo[i] = (i * 7919) & 0xff;
    const encoded = photo.toString('base64');
    const bytes = base64ToBytes(encoded);
    assert.equal(bytes.length, base64ByteLength(encoded));
    assert.ok(Buffer.from(bytes).equals(photo));
  });

  it('ignores line breaks', () => {
    assert.deepEqual(Buffer.from(base64ToBytes('YWJj\nZGVm')), Buffer.from('abcdef'));
  });

  it('rejects text that is not base64', () => {
    assert.throws(() => base64ToBytes('YWJ'));
    assert.throws(() => base64ToBytes('YW=j'));
    assert.throws(() => base64ToBytes('YW-_'));
    assert.throws(() => base64ToBytes('data:image/jpeg;base64,YWJj'));
  });

  // The phone bug (2026-11-17): Firestore's React Native Bytes.fromBase64String spreads every
  // byte into one Function.prototype.apply call, which Hermes rejects for a photo this size.
  // Node allows far more arguments, so simulate the engine limit here.
  it('never passes one argument per byte to a function call (Hermes argument limit)', () => {
    const LIMIT = 65_536;
    const realApply = Function.prototype.apply;
    const guardedApply = function (this: (...args: unknown[]) => unknown, thisArg: unknown, args?: ArrayLike<unknown>) {
      if (args && args.length > LIMIT) throw new RangeError('Maximum call stack size exceeded');
      return Reflect.apply(this, thisArg, args ? Array.from(args) : []);
    };
    const encoded = Buffer.alloc(300_000, 0xab).toString('base64');
    Function.prototype.apply = guardedApply as typeof realApply;
    try {
      assert.equal(base64ToBytes(encoded).length, 300_000);
      // The guard really does catch the pattern the SDK uses.
      assert.throws(
        () => String.fromCharCode.apply(null, Array.from(Buffer.alloc(300_000))),
        RangeError,
      );
    } finally {
      Function.prototype.apply = realApply;
    }
  });
});
