/// <reference types="node" />

// Ranking and labels of geocoder place results (rankPlaceResults, formatPlaceLabel) in the
// pickup/destination search, with the real service-area and barangay boundaries.
// Run with `npm run test:unit`.
// Imports only alias-free files: Node's type stripping does not resolve the "@/..." aliases.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BARANGAY_BOUNDARIES } from '../../src/constants/barangayBoundaries.ts';
import { getBarangayPinPoint } from '../../src/constants/barangayPinPoints.ts';
import { TRIGO_SERVICE_AREA } from '../../src/constants/serviceArea.ts';
import { searchBarangayLocations } from '../../src/utils/barangaySearch.ts';
import {
  formatPlaceLabel,
  rankPlaceResults,
  type PlaceCandidate,
  type RankPlacesOptions,
} from '../../src/utils/placeResults.ts';
import {
  distanceToPolygonEdgeMeters,
  findAreaContaining,
  isInsidePolygon,
} from '../../src/utils/polygon.ts';

// Same checks as isWithinTrigoServiceArea, findBarangayAt and distanceFromServiceAreaCenterKm
// (src/services/serviceAreaService.ts, which uses "@/..." imports).
const { boundary, edgeToleranceMeters, center } = TRIGO_SERVICE_AREA;
const isWithinServiceArea = (latitude: number, longitude: number) =>
  isInsidePolygon(latitude, longitude, boundary) ||
  distanceToPolygonEdgeMeters(latitude, longitude, boundary) <= edgeToleranceMeters;
const findBarangayAt = (latitude: number, longitude: number) =>
  findAreaContaining(latitude, longitude, BARANGAY_BOUNDARIES, edgeToleranceMeters);
const distanceFromCenterKm = (latitude: number, longitude: number) =>
  Math.hypot(latitude - center.latitude, longitude - center.longitude) * 111;

const options = (overrides: Partial<RankPlacesOptions> = {}): RankPlacesOptions => ({
  isWithinServiceArea,
  findBarangayAt,
  distanceFromCenterKm,
  barangayResults: [],
  max: 5,
  ...overrides,
});

const place = (latitude: number, longitude: number, name: string | null, label: string | null = null) =>
  ({ latitude, longitude, name, label }) satisfies PlaceCandidate;

// ~250 m north-east of the town centre, inside Poblacion.
const cemetery = place(10.0805, 124.3448, 'Trinidad Catholic Cemetery', 'Trinidad Catholic Cemetery, Trinidad, BO, Philippines');
const banlasanPin = getBarangayPinPoint('banlasan');
const banlasanSchool = place(banlasanPin.latitude + 0.004, banlasanPin.longitude, 'Banlasan Elementary School');
const talibon = place(10.1497, 124.3247, 'Talibon', 'Talibon, BO, Philippines');
const tagbilaran = place(9.6467, 123.8547, 'Tagbilaran City', 'Tagbilaran City, BO, Philippines');

const addresses = (candidates: PlaceCandidate[], extra?: Partial<RankPlacesOptions>) =>
  rankPlaceResults(candidates, options(extra)).map(({ address }) => address);

describe('test fixtures', () => {
  it('are where the tests assume', () => {
    assert.equal(findBarangayAt(cemetery.latitude, cemetery.longitude), 'poblacion');
    assert.equal(findBarangayAt(banlasanSchool.latitude, banlasanSchool.longitude), 'banlasan');
    assert.equal(isWithinServiceArea(talibon.latitude, talibon.longitude), false);
    assert.equal(isWithinServiceArea(tagbilaran.latitude, tagbilaran.longitude), false);
  });
});

describe('formatPlaceLabel', () => {
  it('adds the barangay inside Trinidad', () => {
    assert.equal(formatPlaceLabel(cemetery, 'poblacion'), 'Trinidad Catholic Cemetery · Poblacion');
    assert.equal(formatPlaceLabel(banlasanSchool, 'banlasan'), 'Banlasan Elementary School · Banlasan');
  });

  it('adds the town instead when the place is the barangay itself', () => {
    assert.equal(formatPlaceLabel(place(10.08, 124.344, 'Poblacion'), 'poblacion'), 'Poblacion · Trinidad');
    assert.equal(formatPlaceLabel(place(10, 124, 'Kinanoan'), 'kinan-oan'), 'Kinanoan · Trinidad');
  });

  it('uses the full label outside Trinidad, else the name', () => {
    assert.equal(formatPlaceLabel(tagbilaran, null), 'Tagbilaran City, BO, Philippines');
    assert.equal(formatPlaceLabel(place(9.6, 123.8, 'Somewhere'), null), 'Somewhere');
  });

  it('is null without a name (phone geocoder), so the caller reverse geocodes', () => {
    assert.equal(formatPlaceLabel(place(10.08, 124.344, null), 'poblacion'), null);
    assert.equal(formatPlaceLabel(place(9.6, 123.8, null), null), null);
  });
});

describe('rankPlaceResults', () => {
  it('lists places inside Trinidad first, in the geocoder order, labelled with their barangay', () => {
    assert.deepEqual(addresses([tagbilaran, banlasanSchool, talibon, cemetery]), [
      'Banlasan Elementary School · Banlasan',
      'Trinidad Catholic Cemetery · Poblacion',
      'Talibon, BO, Philippines',
      'Tagbilaran City, BO, Philippines',
    ]);
  });

  it('orders places outside Trinidad by distance, and keeps them', () => {
    assert.deepEqual(addresses([tagbilaran, talibon]), [
      'Talibon, BO, Philippines',
      'Tagbilaran City, BO, Philippines',
    ]);
  });

  it('returns place results with their service-area flag', () => {
    const [inside, outside] = rankPlaceResults([cemetery, talibon], options());
    assert.deepEqual(inside, {
      latitude: cemetery.latitude,
      longitude: cemetery.longitude,
      address: 'Trinidad Catholic Cemetery · Poblacion',
      kind: 'place',
      barangayId: null,
      withinServiceArea: true,
    });
    assert.equal(outside.withinServiceArea, false);
    assert.equal(outside.kind, 'place');
  });

  it('drops places within 50 m of an earlier one', () => {
    const nearby = place(cemetery.latitude + 0.0003, cemetery.longitude, 'Cemetery gate');
    const apart = place(cemetery.latitude + 0.001, cemetery.longitude, 'Chapel');
    assert.deepEqual(addresses([cemetery, nearby, apart]), [
      'Trinidad Catholic Cemetery · Poblacion',
      'Chapel · Poblacion',
    ]);
  });

  it('drops places duplicating a barangay suggestion: next to its pin, or named after it', () => {
    const barangayResults = searchBarangayLocations('banlasan');
    const atPin = place(banlasanPin.latitude + 0.0002, banlasanPin.longitude, 'Banlasan Purok 1');
    const namedLikeIt = place(banlasanPin.latitude - 0.003, banlasanPin.longitude, 'Brgy. Banlasan');

    assert.deepEqual(addresses([atPin, namedLikeIt, banlasanSchool], { barangayResults }), [
      'Banlasan Elementary School · Banlasan',
    ]);
    // Without that suggestion they are ordinary places.
    assert.deepEqual(addresses([atPin, namedLikeIt]), ['Banlasan Purok 1 · Banlasan', 'Brgy. Banlasan · Trinidad']);
  });

  it('keeps a place named after a barangay when it lies in a different one', () => {
    const barangayResults = searchBarangayLocations('banlasan');
    const elsewhere = place(cemetery.latitude, cemetery.longitude, 'Banlasan');
    assert.deepEqual(addresses([elsewhere], { barangayResults }), ['Banlasan · Poblacion']);
  });

  it('leaves unnamed phone-geocoder places for reverse geocoding', () => {
    assert.deepEqual(addresses([place(cemetery.latitude, cemetery.longitude, null)]), [null]);
  });

  it('lists at most `max` places', () => {
    const many = Array.from({ length: 8 }, (_, i) => place(10.07 + i * 0.002, 124.34, `Place ${i}`));
    assert.equal(rankPlaceResults(many, options({ max: 5 })).length, 5);
    assert.deepEqual(rankPlaceResults([], options()), []);
  });
});
