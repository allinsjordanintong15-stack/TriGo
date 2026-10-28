/// <reference types="node" />

// Fare rules (quoteFare): Poblacion <-> barangay X uses X's active tariff for the vehicle
// type, in both directions; everything else inside Trinidad and every out-of-area trip uses
// the per-km fare. Points are resolved through the real PSA boundaries with the same lookup
// as findBarangayAt() (findAreaContaining, 150 m edge tolerance).
// Run with `npm run test:unit`.
// Imports only alias-free files: Node's type stripping does not resolve the "@/..." aliases.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { BARANGAY_BOUNDARIES } from '../../src/constants/barangayBoundaries.ts';
import type { FareSettings, VehicleType } from '../../src/types/index.ts';
import {
  calculatePerKmFare,
  quoteFare,
  type BarangayTariffs,
  type FareQuoteInput,
} from '../../src/utils/fareQuote.ts';
import { findAreaContaining } from '../../src/utils/polygon.ts';

// Same as TRIGO_SERVICE_AREA.edgeToleranceMeters (src/constants/serviceArea.ts).
const EDGE_TOLERANCE_METERS = 150;

const findBarangayAt = (latitude: number, longitude: number) =>
  findAreaContaining(latitude, longitude, BARANGAY_BOUNDARIES, EDGE_TOLERANCE_METERS);

type Point = { latitude: number; longitude: number };

// PSA center points of each barangay, by TriGo ID.
const CENTERS: Record<string, Point> = (() => {
  const geojson = JSON.parse(
    readFileSync(new URL('../../data/trinidad-barangays.geojson', import.meta.url), 'utf8'),
  ) as { features: { properties: { adm4_pcode: string; center_lat: number; center_lon: number } }[] };
  return Object.fromEntries(
    geojson.features.map(({ properties }) => [
      BARANGAY_BOUNDARIES.find((b) => `PH${b.psgcCode}` === properties.adm4_pcode)!.id,
      { latitude: properties.center_lat, longitude: properties.center_lon },
    ]),
  );
})();

const POBLACION_CENTER: Point = { latitude: 10.0792, longitude: 124.343 }; // TRIGO_SERVICE_AREA.center
// Either side of the Poblacion / La Victoria border, about 50 m apart.
const POBLACION_SIDE_OF_BORDER: Point = { latitude: 10.084246, longitude: 124.346854 };
const LA_VICTORIA_SIDE_OF_BORDER: Point = { latitude: 10.084414, longitude: 124.347276 };
// North of the municipal edge in La Victoria: ~85 m out (within tolerance) and ~300 m out.
const PIN_JUST_OUTSIDE_EDGE: Point = { latitude: 10.0992, longitude: 124.3447 };
const PIN_FAR_OUTSIDE_EDGE: Point = { latitude: 10.1014, longitude: 124.3447 };
const TAGBILARAN: Point = { latitude: 9.6467, longitude: 123.8547 };

const FARE_SETTINGS: FareSettings = {
  tricycle: { baseFare: 15, perKm: 8.5 },
  motorcycle: { baseFare: 12, perKm: 7 },
};

const TARIFFS: BarangayTariffs = {
  bongbong: { tricycle: 40.5, motorcycle: 30.25, active: true },
  'la-victoria': { tricycle: 25, motorcycle: 20, active: true },
  soom: { tricycle: 50, motorcycle: 45, active: false },
  // guinobatan: no tariff saved
};

const VEHICLES: VehicleType[] = ['tricycle', 'motorcycle'];
const DISTANCE_KM = 4.37;

function quote(
  pickup: Point,
  destination: Point,
  vehicleType: VehicleType,
  overrides: Partial<FareQuoteInput> = {},
) {
  return quoteFare({
    vehicleType,
    distanceKm: DISTANCE_KM,
    fareSettings: FARE_SETTINGS,
    isOutOfArea: false,
    pickupBarangayId: findBarangayAt(pickup.latitude, pickup.longitude),
    destinationBarangayId: findBarangayAt(destination.latitude, destination.longitude),
    tariffs: TARIFFS,
    ...overrides,
  });
}

function perKm(vehicleType: VehicleType) {
  return {
    fare: calculatePerKmFare(vehicleType, DISTANCE_KM, FARE_SETTINGS),
    fareBasis: 'per_km',
    tariffBarangayId: null,
    perKmRate: FARE_SETTINGS[vehicleType].perKm,
  };
}

function tariff(barangayId: string, fare: number) {
  return { fare, fareBasis: 'barangay_tariff', tariffBarangayId: barangayId, perKmRate: null };
}

describe('calculatePerKmFare', () => {
  it('is base fare + rate x distance, kept to the centavo', () => {
    assert.equal(calculatePerKmFare('tricycle', DISTANCE_KM, FARE_SETTINGS), 52.15); // 15 + 37.145
    assert.equal(calculatePerKmFare('motorcycle', DISTANCE_KM, FARE_SETTINGS), 42.59); // 12 + 30.59
    assert.equal(calculatePerKmFare('tricycle', 0, FARE_SETTINGS), 15);
  });
});

describe('Poblacion <-> barangay with an active tariff', () => {
  for (const vehicleType of VEHICLES) {
    it(`Poblacion -> Bongbong (${vehicleType}) is Bongbong's tariff`, () => {
      assert.deepEqual(
        quote(POBLACION_CENTER, CENTERS.bongbong, vehicleType),
        tariff('bongbong', TARIFFS.bongbong![vehicleType]),
      );
    });

    it(`Bongbong -> Poblacion (${vehicleType}) is the same tariff`, () => {
      assert.deepEqual(
        quote(CENTERS.bongbong, POBLACION_CENTER, vehicleType),
        tariff('bongbong', TARIFFS.bongbong![vehicleType]),
      );
    });
  }

  it('keeps centavos and ignores the distance', () => {
    const short = quote(POBLACION_CENTER, CENTERS.bongbong, 'motorcycle', { distanceKm: 0.5 });
    const long = quote(POBLACION_CENTER, CENTERS.bongbong, 'motorcycle', { distanceKm: 20 });
    assert.equal(short.fare, 30.25);
    assert.equal(long.fare, 30.25);
  });
});

describe('per-km inside Trinidad', () => {
  for (const vehicleType of VEHICLES) {
    it(`barangay <-> barangay (Bongbong -> Soom, ${vehicleType})`, () => {
      assert.deepEqual(quote(CENTERS.bongbong, CENTERS.soom, vehicleType), perKm(vehicleType));
    });

    it(`within Poblacion (${vehicleType})`, () => {
      assert.deepEqual(quote(POBLACION_CENTER, CENTERS.poblacion, vehicleType), perKm(vehicleType));
    });

    it(`within one barangay (Bongbong, ${vehicleType})`, () => {
      assert.deepEqual(quote(CENTERS.bongbong, CENTERS.bongbong, vehicleType), perKm(vehicleType));
    });

    it(`inactive tariff, both directions (Soom, ${vehicleType})`, () => {
      assert.deepEqual(quote(POBLACION_CENTER, CENTERS.soom, vehicleType), perKm(vehicleType));
      assert.deepEqual(quote(CENTERS.soom, POBLACION_CENTER, vehicleType), perKm(vehicleType));
    });

    it(`no tariff saved, both directions (Guinobatan, ${vehicleType})`, () => {
      assert.deepEqual(quote(POBLACION_CENTER, CENTERS.guinobatan, vehicleType), perKm(vehicleType));
      assert.deepEqual(quote(CENTERS.guinobatan, POBLACION_CENTER, vehicleType), perKm(vehicleType));
    });

    it(`tariffs could not be loaded (${vehicleType})`, () => {
      assert.deepEqual(
        quote(POBLACION_CENTER, CENTERS.bongbong, vehicleType, { tariffs: {} }),
        perKm(vehicleType),
      );
    });
  }
});

describe('borders', () => {
  it('a point just inside Poblacion at the La Victoria border counts as Poblacion', () => {
    assert.equal(
      findBarangayAt(POBLACION_SIDE_OF_BORDER.latitude, POBLACION_SIDE_OF_BORDER.longitude),
      'poblacion',
    );
    assert.deepEqual(
      quote(POBLACION_SIDE_OF_BORDER, CENTERS['la-victoria'], 'tricycle'),
      tariff('la-victoria', 25),
    );
  });

  it('a point just across the border in La Victoria counts as La Victoria', () => {
    assert.equal(
      findBarangayAt(LA_VICTORIA_SIDE_OF_BORDER.latitude, LA_VICTORIA_SIDE_OF_BORDER.longitude),
      'la-victoria',
    );
    assert.deepEqual(
      quote(LA_VICTORIA_SIDE_OF_BORDER, POBLACION_CENTER, 'motorcycle'),
      tariff('la-victoria', 20),
    );
  });

  it('a short trip across the border is the La Victoria tariff; staying on one side is per-km', () => {
    assert.deepEqual(
      quote(POBLACION_SIDE_OF_BORDER, LA_VICTORIA_SIDE_OF_BORDER, 'tricycle', { distanceKm: 0.05 }),
      tariff('la-victoria', 25),
    );
    assert.equal(
      quote(POBLACION_SIDE_OF_BORDER, POBLACION_CENTER, 'tricycle').fareBasis,
      'per_km',
    );
  });

  it('a pin within the edge tolerance outside the municipal edge counts as the nearest barangay', () => {
    assert.deepEqual(
      quote(PIN_JUST_OUTSIDE_EDGE, POBLACION_CENTER, 'tricycle'),
      tariff('la-victoria', 25),
    );
  });
});

describe('outside Trinidad', () => {
  it('a pin beyond the edge tolerance is in no barangay, so Poblacion trips to it are per-km', () => {
    assert.equal(findBarangayAt(PIN_FAR_OUTSIDE_EDGE.latitude, PIN_FAR_OUTSIDE_EDGE.longitude), null);
    assert.deepEqual(quote(POBLACION_CENTER, PIN_FAR_OUTSIDE_EDGE, 'tricycle'), perKm('tricycle'));
    assert.deepEqual(quote(PIN_FAR_OUTSIDE_EDGE, POBLACION_CENTER, 'motorcycle'), perKm('motorcycle'));
  });

  for (const vehicleType of VEHICLES) {
    it(`out-of-area trips are always per-km, both directions (${vehicleType})`, () => {
      assert.deepEqual(
        quote(POBLACION_CENTER, TAGBILARAN, vehicleType, { isOutOfArea: true }),
        perKm(vehicleType),
      );
      assert.deepEqual(
        quote(TAGBILARAN, POBLACION_CENTER, vehicleType, { isOutOfArea: true }),
        perKm(vehicleType),
      );
    });
  }

  it('out-of-area is per-km even when both ends resolve to Poblacion and a tariffed barangay', () => {
    assert.deepEqual(
      quote(POBLACION_CENTER, CENTERS.bongbong, 'tricycle', { isOutOfArea: true }),
      perKm('tricycle'),
    );
  });
});
