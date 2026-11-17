/// <reference types="node" />

// Fares tab preview (admin/src/fares/farePreview.ts) and the shared fare formula: the app
// and the admin site use the same function (shared/fares). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PREVIEW_DISTANCES_KM, previewCell } from '../../admin/src/fares/farePreview.ts';
import { perKmFare as adminPerKmFare } from '../../admin/src/lib/fares.ts';
import { perKmFare } from '../../shared/fares/index.ts';
import { calculatePerKmFare } from '../../src/utils/fareQuote.ts';
import type { FareSettings } from '../../src/types/index.ts';

const TRICYCLE = { baseFare: 15, perKm: 8 };

describe('shared perKmFare', () => {
  it('is base fare + rate × distance, kept to the centavo', () => {
    assert.equal(perKmFare(TRICYCLE, 3), 39);
    assert.equal(perKmFare({ baseFare: 15, perKm: 7.43 }, 5), 52.15); // 15 + 37.15
    assert.equal(perKmFare({ baseFare: 0.1, perKm: 0.2 }, 1), 0.3); // not 0.30000000000000004
  });

  it('is the function the admin site and the app use', () => {
    assert.equal(adminPerKmFare, perKmFare);
    const settings = { tricycle: TRICYCLE, motorcycle: { baseFare: 12, perKm: 6.18 } } as unknown as FareSettings;
    for (const km of [0, 1, 2.37, 4.643, 10]) {
      assert.equal(calculatePerKmFare('tricycle', km, settings), perKmFare(TRICYCLE, km));
      assert.equal(calculatePerKmFare('motorcycle', km, settings), perKmFare({ baseFare: 12, perKm: 6.18 }, km));
    }
  });
});

describe('previewCell', () => {
  it('previews 1, 3, 5 and 10 km', () => {
    assert.deepEqual([...PREVIEW_DISTANCES_KM], [1, 3, 5, 10]);
  });

  it('shows old → new when the edited rates change the fare', () => {
    assert.deepEqual(previewCell(TRICYCLE, { baseFare: 20, perKm: 8 }, 5), { current: 55, next: 60, changed: true });
  });

  it('is unchanged when the edited rates give the same fare', () => {
    assert.deepEqual(previewCell(TRICYCLE, { ...TRICYCLE }, 3), { current: 39, next: 39, changed: false });
  });

  it('has no new fare while a rate is invalid', () => {
    assert.deepEqual(previewCell(TRICYCLE, null, 10), { current: 95, next: null, changed: false });
  });
});
