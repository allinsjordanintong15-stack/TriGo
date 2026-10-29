/// <reference types="node" />

// Barangay pin points (getBarangayPinPoint): the pin for a barangay search result must be
// inside that barangay, away from its edge, and resolve back to it. Covers the computed
// interior points and any curated points in src/constants/barangayPinPoints.ts.
// Run with `npm run test:unit`.
// Imports only alias-free files: Node's type stripping does not resolve the "@/..." aliases.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BARANGAY_BOUNDARIES } from '../../src/constants/barangayBoundaries.ts';
import {
  CURATED_BARANGAY_PIN_POINTS,
  getBarangayPinPoint,
} from '../../src/constants/barangayPinPoints.ts';
import { BARANGAYS, POBLACION_ID, type BoundaryBarangayId } from '../../src/constants/barangays.ts';
import {
  distanceToPolygonEdgeMeters,
  findAreaContaining,
  isInsidePolygon,
} from '../../src/utils/polygon.ts';

// Same value as TRIGO_SERVICE_AREA.edgeToleranceMeters (src/constants/serviceArea.ts).
const EDGE_TOLERANCE_METERS = 150;
const MIN_EDGE_DISTANCE_METERS = 100;

const ALL_IDS: BoundaryBarangayId[] = [POBLACION_ID, ...BARANGAYS.map((barangay) => barangay.id)];

describe('barangay pin points', () => {
  it('has a pin point for Poblacion and all 19 barangays', () => {
    assert.equal(ALL_IDS.length, 20);
    for (const id of ALL_IDS) assert.doesNotThrow(() => getBarangayPinPoint(id), id);
  });

  for (const { id, boundary } of BARANGAY_BOUNDARIES) {
    it(`${id}: pin is inside its own barangay, away from the edge, and resolves to it`, () => {
      const { latitude, longitude } = getBarangayPinPoint(id);

      assert.ok(isInsidePolygon(latitude, longitude, boundary), 'outside its own boundary');
      const edgeMeters = distanceToPolygonEdgeMeters(latitude, longitude, boundary);
      assert.ok(edgeMeters >= MIN_EDGE_DISTANCE_METERS, `only ${Math.round(edgeMeters)} m from the edge`);

      const others = BARANGAY_BOUNDARIES.filter((area) => area.id !== id);
      for (const other of others) {
        assert.ok(!isInsidePolygon(latitude, longitude, other.boundary), `also inside ${other.id}`);
      }
      assert.equal(
        findAreaContaining(latitude, longitude, BARANGAY_BOUNDARIES, EDGE_TOLERANCE_METERS),
        id,
      );
    });
  }

  it('uses the computed interior point when no curated point is set', () => {
    for (const { id, interiorPoint } of BARANGAY_BOUNDARIES) {
      if (CURATED_BARANGAY_PIN_POINTS[id]) continue;
      const [latitude, longitude] = interiorPoint;
      assert.deepEqual(getBarangayPinPoint(id), { latitude, longitude }, id);
    }
  });

  it('pins Poblacion at the town centre', () => {
    // Same value as TRIGO_SERVICE_AREA.center (src/constants/serviceArea.ts).
    assert.deepEqual(getBarangayPinPoint(POBLACION_ID), { latitude: 10.0792, longitude: 124.343 });
  });

  it('only has curated points for known barangays, as [latitude, longitude]', () => {
    for (const [id, point] of Object.entries(CURATED_BARANGAY_PIN_POINTS)) {
      assert.ok(ALL_IDS.includes(id as BoundaryBarangayId), `unknown barangay ${id}`);
      const [lat, lon] = point;
      assert.ok(lat > 9.9 && lat < 10.2 && lon > 124.1 && lon < 124.5, `${id} [${lat}, ${lon}]`);
    }
  });
});
