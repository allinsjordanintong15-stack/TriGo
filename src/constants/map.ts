/**
 * Default map viewport — the Municipality of Trinidad, Bohol and its immediate neighbours
 * (map framing only — not used as booking data or as a service-area check).
 */
export const TRINIDAD_BOHOL_REGION = {
  latitude: 10.0468,
  longitude: 124.3189,
  latitudeDelta: 0.14,
  longitudeDelta: 0.2,
} as const;

export const MAP_DELTA = {
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
} as const;
