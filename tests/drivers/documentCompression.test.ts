/// <reference types="node" />

// Driver application document photos: which compression step is used
// (src/utils/documentCompression.ts). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DOCUMENT_COMPRESSION_STEPS,
  DOCUMENT_IMAGE_MAX_BYTES,
  DOCUMENT_IMAGE_TARGET_BYTES,
} from '../../src/constants/applicationDocuments.ts';
import {
  base64ByteLength,
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
    assert.equal(DOCUMENT_IMAGE_TARGET_BYTES, 700_000);
    assert.equal(DOCUMENT_IMAGE_MAX_BYTES, 900_000);
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
  it('stops at the first step at or under 700 KB', async () => {
    const { encode, calls } = fakeEncoder([650_000]);
    const outcome = await compressWithSteps(encode, PHONE_PHOTO);
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.ok && outcome.step, { longSide: 1600, quality: 0.7 });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].size, { width: 1600, height: 1200 });
  });

  it('accepts exactly 700 KB', async () => {
    const { encode, calls } = fakeEncoder([700_000]);
    assert.equal((await compressWithSteps(encode, PHONE_PHOTO)).ok, true);
    assert.equal(calls.length, 1);
  });

  it('steps the quality down before the size', async () => {
    const { encode, calls } = fakeEncoder([900_000, 760_000, 690_000]);
    const outcome = await compressWithSteps(encode, PHONE_PHOTO);
    assert.deepEqual(outcome.ok && outcome.step, { longSide: 1600, quality: 0.5 });
    assert.deepEqual(
      calls.map((c) => c.step.quality),
      [0.7, 0.6, 0.5],
    );
  });

  it('drops the longest side to 1280 px last', async () => {
    const { encode, calls } = fakeEncoder([1_200_000, 1_000_000, 850_000, 600_000]);
    const outcome = await compressWithSteps(encode, PHONE_PHOTO);
    assert.deepEqual(outcome.ok && outcome.step, { longSide: 1280, quality: 0.5 });
    assert.deepEqual(calls[3].size, { width: 1280, height: 960 });
  });

  it('uses the smallest result when none reaches 700 KB but it is under 900 KB', async () => {
    const { encode } = fakeEncoder([1_200_000, 1_000_000, 899_999, 880_000]);
    const outcome = await compressWithSteps(encode, PHONE_PHOTO);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.ok && outcome.image.sizeBytes, 880_000);
    assert.deepEqual(outcome.ok && outcome.step, { longSide: 1280, quality: 0.5 });
  });

  it('never returns a photo of 900 KB or more', async () => {
    const { encode, calls } = fakeEncoder([2_000_000, 1_500_000, 1_100_000, 900_000]);
    const outcome = await compressWithSteps(encode, PHONE_PHOTO);
    assert.deepEqual(outcome, { ok: false, reason: 'too-large', smallestBytes: 900_000 });
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
