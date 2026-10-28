/// <reference types="node" />

// Barangay boundary checks (no emulator): the barangay ID/name list is identical in the
// mobile app, the admin website and firestore.rules; the generated boundaries cover exactly
// those IDs plus Poblacion; and the point lookup resolves known points.
// Run with `npm run test:barangays`.
// Imports only alias-free files: Node's type stripping does not resolve the "@/..." aliases.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { BARANGAYS as ADMIN_BARANGAYS } from '../../admin/src/tariffs/barangays.ts';
import { BARANGAY_BOUNDARIES } from '../../src/constants/barangayBoundaries.ts';
import { BARANGAYS, POBLACION_ID } from '../../src/constants/barangays.ts';
import { findAreaContaining } from '../../src/utils/polygon.ts';

// Same values as TRIGO_SERVICE_AREA (src/constants/serviceArea.ts).
const EDGE_TOLERANCE_METERS = 150;
const POBLACION_CENTER = { latitude: 10.0792, longitude: 124.343 };

function rulesBarangayNames(): Record<string, string> {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const body = rules.match(/function barangayNames\(\) \{\s*return \{([\s\S]*?)\};/);
  assert.ok(body, 'barangayNames() not found in firestore.rules');

  return Object.fromEntries(
    [...body[1].matchAll(/'([^']+)':\s*'([^']+)'/g)].map(([, id, name]) => [id, name]),
  );
}

const toMap = (list: readonly { id: string; name: string }[]) =>
  Object.fromEntries(list.map(({ id, name }) => [id, name]));

const findBarangay = (latitude: number, longitude: number) =>
  findAreaContaining(latitude, longitude, BARANGAY_BOUNDARIES, EDGE_TOLERANCE_METERS);

describe('barangay lists', () => {
  it('has 19 barangays with unique IDs', () => {
    assert.equal(BARANGAYS.length, 19);
    assert.equal(new Set(BARANGAYS.map((b) => b.id)).size, 19);
  });

  it('mobile list matches the admin list (same order)', () => {
    assert.deepEqual(
      BARANGAYS.map((b) => [b.id, b.name]),
      ADMIN_BARANGAYS.map((b) => [b.id, b.name]),
    );
  });

  it('mobile list matches firestore.rules barangayNames()', () => {
    assert.deepEqual(rulesBarangayNames(), toMap(BARANGAYS));
  });

  it('boundaries cover exactly the 19 barangays plus Poblacion, with the same names', () => {
    assert.deepEqual(toMap(BARANGAY_BOUNDARIES), {
      ...toMap(BARANGAYS),
      [POBLACION_ID]: 'Poblacion',
    });
  });

  it('every boundary is a closed ring of [latitude, longitude] points in Trinidad', () => {
    for (const { id, boundary } of BARANGAY_BOUNDARIES) {
      assert.ok(boundary.length >= 4, id);
      assert.deepEqual(boundary[0], boundary[boundary.length - 1], `${id} ring not closed`);
      for (const [lat, lon] of boundary) {
        assert.ok(lat > 9.9 && lat < 10.2 && lon > 124.1 && lon < 124.5, `${id} [${lat}, ${lon}]`);
      }
    }
  });
});

describe('barangay lookup', () => {
  it('resolves the Trinidad town center to Poblacion', () => {
    assert.equal(findBarangay(POBLACION_CENTER.latitude, POBLACION_CENTER.longitude), POBLACION_ID);
  });

  it('resolves each barangay center (PSA center_lat/center_lon) to that barangay', () => {
    const geojson = JSON.parse(
      readFileSync(new URL('../../data/trinidad-barangays.geojson', import.meta.url), 'utf8'),
    ) as { features: { properties: { adm4_pcode: string; center_lat: number; center_lon: number } }[] };

    for (const { properties } of geojson.features) {
      const expected = BARANGAY_BOUNDARIES.find((b) => `PH${b.psgcCode}` === properties.adm4_pcode);
      assert.ok(expected, properties.adm4_pcode);
      assert.equal(findBarangay(properties.center_lat, properties.center_lon), expected.id);
    }
  });

  it('returns null outside Trinidad', () => {
    assert.equal(findBarangay(9.6467, 123.8547), null); // Tagbilaran City
    assert.equal(findBarangay(10.15, 124.2), null); // Bohol Sea, north-west of Trinidad
  });
});
