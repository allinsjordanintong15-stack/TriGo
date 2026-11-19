/// <reference types="node" />

// Trip limits (security batch A): shared/bookings/limits.ts and firestore.rules must use the
// same numbers, and the rules' default per-km fares must equal the app's
// DEFAULT_FARE_SETTINGS. Also checks the shared helpers. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  BOHOL_BOUNDS,
  isPlausibleDistance,
  isValidFareAmount,
  isWithinBounds,
  KM_PER_DEGREE_LATITUDE,
  KM_PER_DEGREE_LONGITUDE,
  MAX_ADDRESS_LENGTH,
  MAX_DISTANCE_KM,
  MAX_FARE_PESOS,
  MAX_ROAD_FACTOR,
  MIN_ROAD_FACTOR,
  PHILIPPINES_BOUNDS,
  ROAD_SLACK_KM,
  straightLineKm,
  toStoredLocation,
} from '../../shared/bookings/limits.ts';

const rules = readFileSync('firestore.rules', 'utf8').replace(/\r\n/g, '\n');

function ruleFunctionValue(name: string): number {
  const match = new RegExp(`function ${name}\\(\\) \\{\\n\\s*return ([0-9.]+);`).exec(rules);
  assert.ok(match, `function ${name}() not found in firestore.rules`);
  return Number(match[1]);
}

describe('firestore.rules matches shared/bookings/limits.ts', () => {
  it('maximum fare, distance and address length', () => {
    assert.equal(ruleFunctionValue('maxFarePesos'), MAX_FARE_PESOS);
    assert.equal(ruleFunctionValue('maxDistanceKm'), MAX_DISTANCE_KM);
    assert.equal(ruleFunctionValue('maxAddressLength'), MAX_ADDRESS_LENGTH);
  });

  it('distance plausibility constants', () => {
    assert.ok(rules.includes(`(b.longitude - a.longitude) * ${KM_PER_DEGREE_LONGITUDE}`));
    assert.ok(rules.includes(`(b.latitude - a.latitude) * ${KM_PER_DEGREE_LATITUDE}`));
    assert.ok(rules.includes(`distanceKm >= ${MIN_ROAD_FACTOR} * straight`));
    assert.ok(rules.includes(`distanceKm <= ${MAX_ROAD_FACTOR} * straight + ${ROAD_SLACK_KM}`));
  });

  it('Bohol and Philippines boxes', () => {
    assert.ok(
      rules.includes(
        `loc.latitude >= ${BOHOL_BOUNDS.minLatitude} && loc.latitude <= ${BOHOL_BOUNDS.maxLatitude}\n        && loc.longitude >= ${BOHOL_BOUNDS.minLongitude} && loc.longitude <= ${BOHOL_BOUNDS.maxLongitude};`,
      ),
      'Bohol box differs',
    );
    assert.ok(
      rules.includes(
        `loc.latitude >= ${PHILIPPINES_BOUNDS.minLatitude.toFixed(1)} && loc.latitude <= ${PHILIPPINES_BOUNDS.maxLatitude}\n        && loc.longitude >= ${PHILIPPINES_BOUNDS.minLongitude.toFixed(1)} && loc.longitude <= ${PHILIPPINES_BOUNDS.maxLongitude.toFixed(1)};`,
      ),
      'Philippines box differs',
    );
  });

  it('default per-km fares equal DEFAULT_FARE_SETTINGS (src/constants/index.ts)', () => {
    const constants = readFileSync('src/constants/index.ts', 'utf8');
    const app = /DEFAULT_FARE_SETTINGS[^=]*=\s*\{\s*tricycle:\s*\{\s*baseFare:\s*([0-9.]+),\s*perKm:\s*([0-9.]+),?\s*\},\s*motorcycle:\s*\{\s*baseFare:\s*([0-9.]+),\s*perKm:\s*([0-9.]+)/.exec(
      constants,
    );
    assert.ok(app, 'DEFAULT_FARE_SETTINGS not found');
    const ruleDefaults = /'tricycle': \{ 'baseFare': ([0-9.]+), 'perKm': ([0-9.]+) \},\n\s*'motorcycle': \{ 'baseFare': ([0-9.]+), 'perKm': ([0-9.]+) \}/.exec(
      rules,
    );
    assert.ok(ruleDefaults, 'activeFares() defaults not found');
    assert.deepEqual(ruleDefaults.slice(1).map(Number), app.slice(1).map(Number));
  });
});

describe('shared trip limit helpers', () => {
  it('straight line: 0.1° of latitude is 11.06 km', () => {
    const km = straightLineKm({ latitude: 10, longitude: 124 }, { latitude: 10.1, longitude: 124 });
    assert.ok(Math.abs(km - 11.06) < 1e-9);
  });

  it('plausible distance edges', () => {
    const a = { latitude: 10, longitude: 124.3 };
    const b = { latitude: 10.1, longitude: 124.3 };
    assert.equal(isPlausibleDistance(9.96, a, b), true);
    assert.equal(isPlausibleDistance(9.95, a, b), false);
    assert.equal(isPlausibleDistance(46.2, a, b), true);
    assert.equal(isPlausibleDistance(46.3, a, b), false);
    assert.equal(isPlausibleDistance(0, a, a), false);
    assert.equal(isPlausibleDistance(2, a, a), true);
    assert.equal(isPlausibleDistance(Number.NaN, a, b), false);
    assert.equal(isPlausibleDistance(MAX_DISTANCE_KM + 1, { latitude: 5, longitude: 117 }, { latitude: 20, longitude: 126 }), false);
  });

  it('fare amounts', () => {
    assert.equal(isValidFareAmount(43), true);
    assert.equal(isValidFareAmount(8.15), true);
    assert.equal(isValidFareAmount(0), false);
    assert.equal(isValidFareAmount(-1), false);
    assert.equal(isValidFareAmount(0.001), false);
    assert.equal(isValidFareAmount(Number.NaN), false);
    assert.equal(isValidFareAmount(Number.POSITIVE_INFINITY), false);
    assert.equal(isValidFareAmount(MAX_FARE_PESOS), true);
    assert.equal(isValidFareAmount(MAX_FARE_PESOS + 0.01), false);
  });

  it('bounds: Trinidad and Tagbilaran are in Bohol, Cebu City is not', () => {
    assert.equal(isWithinBounds({ latitude: 10.08, longitude: 124.34 }, BOHOL_BOUNDS), true);
    assert.equal(isWithinBounds({ latitude: 9.65, longitude: 123.85 }, BOHOL_BOUNDS), true);
    assert.equal(isWithinBounds({ latitude: 10.3157, longitude: 123.8854 }, BOHOL_BOUNDS), false);
    assert.equal(isWithinBounds({ latitude: 10.3157, longitude: 123.8854 }, PHILIPPINES_BOUNDS), true);
    assert.equal(isWithinBounds({ latitude: 35.68, longitude: 139.69 }, PHILIPPINES_BOUNDS), false);
  });

  it('stored locations keep exactly three fields and cap the address', () => {
    const stored = toStoredLocation({
      latitude: 10,
      longitude: 124,
      address: 'x'.repeat(250),
      kind: 'place',
      barangayId: null,
    } as never);
    assert.deepEqual(Object.keys(stored).sort(), ['address', 'latitude', 'longitude']);
    assert.equal(stored.address.length, MAX_ADDRESS_LENGTH);
  });
});
