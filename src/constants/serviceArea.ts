/**
 * TriGo primary service area — Trinidad, Bohol.
 * Adjust `radiusKm` to change the geographic boundary without rewriting booking logic.
 */
export const TRIGO_SERVICE_AREA = {
  name: 'Trinidad',
  province: 'Bohol',
  country: 'Philippines',
  center: {
    latitude: 9.7386,
    longitude: 124.3295,
  },
  /** Radius in kilometres from the center point. */
  radiusKm: 7,
} as const;

export type TrigoServiceArea = typeof TRIGO_SERVICE_AREA;
