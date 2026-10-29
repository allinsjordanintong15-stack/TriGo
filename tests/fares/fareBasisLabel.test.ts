/// <reference types="node" />

// Fare basis labels (getFareBasisLabel) shown under standard fares on the passenger and
// driver screens. Run with `npm run test:unit`.
// Imports only alias-free files: Node's type stripping does not resolve the "@/..." aliases.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getFareBasisLabel, type FareBasisFields } from '../../src/utils/fareBasisLabel.ts';

const standardPerKm: FareBasisFields = {
  bookingType: 'standard',
  fareBasis: 'per_km',
  pickupBarangayId: 'poblacion',
  destinationBarangayId: 'poblacion',
  perKmRate: 8,
};

describe('getFareBasisLabel', () => {
  it('names Poblacion first and the tariff barangay, in both directions', () => {
    const tariff: FareBasisFields = {
      ...standardPerKm,
      fareBasis: 'barangay_tariff',
      destinationBarangayId: 'bongbong',
      perKmRate: null,
    };
    assert.equal(getFareBasisLabel(tariff), 'Barangay tariff · Poblacion ↔ Bongbong');
    assert.equal(
      getFareBasisLabel({
        ...tariff,
        pickupBarangayId: 'hinlayagan-ilaud',
        destinationBarangayId: 'poblacion',
      }),
      'Barangay tariff · Poblacion ↔ Hinlayagan Ilaud',
    );
  });

  it('falls back to "Barangay tariff" when the barangay is unknown', () => {
    assert.equal(
      getFareBasisLabel({
        ...standardPerKm,
        fareBasis: 'barangay_tariff',
        pickupBarangayId: 'poblacion',
        destinationBarangayId: 'not-a-barangay',
        perKmRate: null,
      }),
      'Barangay tariff',
    );
  });

  it('shows the per-km rate, or "Per-km fare" for bookings without one', () => {
    assert.equal(getFareBasisLabel(standardPerKm), '₱8.00/km');
    assert.equal(getFareBasisLabel({ ...standardPerKm, perKmRate: 6.5 }), '₱6.50/km');
    assert.equal(
      getFareBasisLabel({
        ...standardPerKm,
        pickupBarangayId: null,
        destinationBarangayId: null,
        perKmRate: null,
      }),
      'Per-km fare',
    );
  });

  it('is null for out-of-area trips', () => {
    assert.equal(getFareBasisLabel({ ...standardPerKm, bookingType: 'out_of_area' }), null);
  });
});
