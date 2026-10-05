import { Location } from '@/types';

/**
 * Road routing through the OpenRouteService Directions API (driving-car profile).
 * https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/geojson/post
 */
const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

const ROUTE_TIMEOUT_MS = 8000;

export interface RoadRoute {
  /** Road distance along the route, in km rounded to 2 decimals. */
  distanceKm: number;
  /** Estimated driving time from ORS, in whole minutes. Display only; never stored. */
  durationMin: number;
  /** Road path as [longitude, latitude] pairs, from pickup to destination. */
  coordinates: [number, number][];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLngLat(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  );
}

/** Pulls the first route out of an ORS GeoJSON FeatureCollection, or null if it has none. */
function parseRoute(body: unknown): RoadRoute | null {
  if (!isRecord(body) || !Array.isArray(body.features)) {
    return null;
  }

  const feature: unknown = body.features[0];
  if (!isRecord(feature) || !isRecord(feature.geometry) || !isRecord(feature.properties)) {
    return null;
  }

  const { coordinates } = feature.geometry;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(isLngLat)) {
    return null;
  }

  const { summary } = feature.properties;
  // ORS leaves `distance` and `duration` out of the summary when pickup and destination
  // are the same point.
  const distanceMeters = isRecord(summary) ? (summary.distance ?? 0) : null;
  if (typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters)) {
    return null;
  }
  const durationSeconds = isRecord(summary) ? (summary.duration ?? 0) : 0;

  return {
    distanceKm: Math.round((distanceMeters / 1000) * 100) / 100,
    durationMin:
      typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
        ? Math.round(durationSeconds / 60)
        : 0,
    // ORS may add elevation as a third value; keep only [longitude, latitude].
    coordinates: coordinates.map(([longitude, latitude]) => [longitude, latitude]),
  };
}

/** ORS error code for "could not find a routable point within the search radius". */
const ORS_NO_ROUTABLE_POINT = 2010;

/** Search radius (m) used on retry when a point is too far from a road (ORS default is 350 m). */
const WIDE_SEARCH_RADIUS_M = 1000;

/** Reads `{ error: { code, message } }` from an ORS error body, if present. */
function parseOrsError(body: unknown): { code: number | null; message: string } {
  const error = isRecord(body) ? body.error : null;
  if (isRecord(error)) {
    return {
      code: typeof error.code === 'number' ? error.code : null,
      message: typeof error.message === 'string' ? error.message : '',
    };
  }
  return { code: null, message: typeof error === 'string' ? error : '' };
}

type RouteAttempt =
  | { ok: true; route: RoadRoute | null }
  | { ok: false; orsCode: number | null };

async function requestRoute(
  apiKey: string,
  pickup: Location,
  destination: Location,
  radiuses?: [number, number],
): Promise<RouteAttempt> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);

  try {
    const response = await fetch(ORS_DIRECTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json, application/json',
      },
      body: JSON.stringify({
        // ORS expects [longitude, latitude].
        coordinates: [
          [pickup.longitude, pickup.latitude],
          [destination.longitude, destination.latitude],
        ],
        ...(radiuses ? { radiuses } : {}),
      }),
      signal: controller.signal,
    });

    const body: unknown = await response.json().catch(() => null);

    if (response.status !== 200) {
      const { code, message } = parseOrsError(body);
      if (__DEV__) {
        console.warn('[TriGo Route] ORS error', { status: response.status, code, message, radiuses });
      }
      return { ok: false, orsCode: code };
    }

    const route = parseRoute(body);
    if (__DEV__) {
      console.log(
        '[TriGo Route] ORS 200',
        route
          ? { distanceKm: route.distanceKm, durationMin: route.durationMin, points: route.coordinates.length, radiuses }
          : 'response had no usable route',
      );
    }
    return { ok: true, route };
  } catch (error) {
    if (__DEV__) {
      console.warn('[TriGo Route] request failed:', error);
    }
    return { ok: false, orsCode: null };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Road route between pickup and destination. Returns null when no ORS key is
 * configured or on any failure (network, timeout, non-200, no route), so callers
 * can fall back to the straight-line distance. If ORS cannot snap a point to a
 * road (code 2010), retries once with a wider search radius.
 */
export async function getRoadRoute(
  pickup: Location,
  destination: Location,
): Promise<RoadRoute | null> {
  const apiKey = process.env.EXPO_PUBLIC_ORS_API_KEY?.trim();
  if (__DEV__) {
    console.log('[TriGo Route] ORS key present:', Boolean(apiKey));
  }
  if (!apiKey) {
    return null;
  }

  const first = await requestRoute(apiKey, pickup, destination);
  if (first.ok) {
    return first.route;
  }

  if (first.orsCode === ORS_NO_ROUTABLE_POINT) {
    const retry = await requestRoute(apiKey, pickup, destination, [
      WIDE_SEARCH_RADIUS_M,
      WIDE_SEARCH_RADIUS_M,
    ]);
    return retry.ok ? retry.route : null;
  }

  return null;
}
