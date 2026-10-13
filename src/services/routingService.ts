import { Location } from "@/types";

/**
 * Road routing through the OpenRouteService Directions API (driving-car profile).
 * First attempt: GET (key as `api_key`, GeoJSON response).
 * https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/get
 * Wider snap radius retry: POST, the only form that accepts `radiuses`.
 * https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/geojson/post
 */
const ORS_DIRECTIONS_GET_URL =
  "https://api.openrouteservice.org/v2/directions/driving-car";
const ORS_DIRECTIONS_POST_URL =
  "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

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
  return typeof value === "object" && value !== null;
}

function isLngLat(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

/** Pulls the first route out of an ORS GeoJSON FeatureCollection, or null if it has none. */
function parseRoute(body: unknown): RoadRoute | null {
  if (!isRecord(body) || !Array.isArray(body.features)) {
    return null;
  }

  const feature: unknown = body.features[0];
  if (
    !isRecord(feature) ||
    !isRecord(feature.geometry) ||
    !isRecord(feature.properties)
  ) {
    return null;
  }

  const { coordinates } = feature.geometry;
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    !coordinates.every(isLngLat)
  ) {
    return null;
  }

  const { summary } = feature.properties;
  // ORS leaves `distance` and `duration` out of the summary when pickup and destination
  // are the same point.
  const distanceMeters = isRecord(summary) ? (summary.distance ?? 0) : null;
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
    return null;
  }
  const durationSeconds = isRecord(summary) ? (summary.duration ?? 0) : 0;

  return {
    distanceKm: Math.round((distanceMeters / 1000) * 100) / 100,
    durationMin:
      typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
        ? Math.round(durationSeconds / 60)
        : 0,
    // ORS may add elevation as a third value; keep only [longitude, latitude].
    coordinates: coordinates.map(([longitude, latitude]) => [
      longitude,
      latitude,
    ]),
  };
}

/** ORS error code for "could not find a routable point within the search radius". */
const ORS_NO_ROUTABLE_POINT = 2010;

/** Search radius (m) used on retry when a point is too far from a road (ORS default is 350 m). */
const WIDE_SEARCH_RADIUS_M = 1000;

/** Reads `{ error: { code, message } }` from an ORS error body, if present. */
function parseOrsError(body: unknown): {
  code: number | null;
  message: string;
} {
  const error = isRecord(body) ? body.error : null;
  if (isRecord(error)) {
    return {
      code: typeof error.code === "number" ? error.code : null,
      message: typeof error.message === "string" ? error.message : "",
    };
  }
  return { code: null, message: typeof error === "string" ? error : "" };
}

type RouteAttempt =
  | { ok: true; route: RoadRoute | null }
  | { ok: false; orsCode: number | null; timedOut: boolean };

/**
 * Why no road route came back. `no_road_near_pin`: ORS found no road near a pin (2010) and
 * the wider-radius retry failed or did not answer in time.
 */
export type RoadRouteFailure = "no_road_near_pin" | "unavailable";

export type RoadRouteResult =
  { ok: true; route: RoadRoute } | { ok: false; reason: RoadRouteFailure };

function formatPoint(point: Location): string {
  return `${point.latitude},${point.longitude}`;
}

/** ORS `start`/`end` query value: "longitude,latitude". */
function toLngLatParam(point: Location): string {
  return `${point.longitude},${point.latitude}`;
}

type RouteRequest = { label: string; url: string; init: RequestInit };

function buildGetRequest(
  apiKey: string,
  pickup: Location,
  destination: Location,
): RouteRequest {
  const params = new URLSearchParams({
    api_key: apiKey,
    start: toLngLatParam(pickup),
    end: toLngLatParam(destination),
  });
  return {
    label: "GET",
    url: `${ORS_DIRECTIONS_GET_URL}?${params.toString()}`,
    init: {
      method: "GET",
      headers: { Accept: "application/geo+json, application/json" },
    },
  };
}

function buildWideRadiusPostRequest(
  apiKey: string,
  pickup: Location,
  destination: Location,
): RouteRequest {
  return {
    label: `POST radiuses ${WIDE_SEARCH_RADIUS_M}`,
    url: ORS_DIRECTIONS_POST_URL,
    init: {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/geo+json, application/json",
      },
      body: JSON.stringify({
        // ORS expects [longitude, latitude].
        coordinates: [
          [pickup.longitude, pickup.latitude],
          [destination.longitude, destination.latitude],
        ],
        radiuses: [WIDE_SEARCH_RADIUS_M, WIDE_SEARCH_RADIUS_M],
      }),
    },
  };
}

/** Error text with the key removed: a GET carries it in the URL, which errors may echo. */
function redactKey(value: unknown, apiKey: string): string {
  return String(value).split(apiKey).join("<key>");
}

async function requestRoute(
  apiKey: string,
  { label, url, init }: RouteRequest,
): Promise<RouteAttempt> {
  // Each attempt has its own controller and timeout.
  const controller = new AbortController();
  const startedAt = Date.now();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ROUTE_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);

    if (response.status !== 200) {
      const { code, message } = parseOrsError(body);
      if (__DEV__) {
        console.warn("[TriGo Route] attempt failed", {
          attempt: label,
          status: response.status,
          orsCode: code,
          message: redactKey(message, apiKey),
          durationMs: Date.now() - startedAt,
        });
      }
      return { ok: false, orsCode: code, timedOut: false };
    }

    const route = parseRoute(body);
    if (__DEV__) {
      console.log("[TriGo Route] attempt ok", {
        attempt: label,
        status: response.status,
        durationMs: Date.now() - startedAt,
        ...(route
          ? {
              distanceKm: route.distanceKm,
              durationMin: route.durationMin,
              points: route.coordinates.length,
            }
          : { result: "response had no usable route" }),
      });
    }
    return { ok: true, route };
  } catch (error) {
    if (__DEV__) {
      // Our own timeout aborts the fetch; RN reports that as "Fetch request has been canceled".
      console.warn("[TriGo Route] attempt failed", {
        attempt: label,
        status: null,
        orsCode: null,
        error: timedOut
          ? `no response within ${ROUTE_TIMEOUT_MS} ms`
          : redactKey(error, apiKey),
        durationMs: Date.now() - startedAt,
      });
    }
    return { ok: false, orsCode: null, timedOut };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Road route between pickup and destination, or why there is none. First a GET request;
 * only if ORS finds no road near a point (code 2010), one POST retry with a wider search
 * radius, which has its own timeout. Without an ORS key the result is `unavailable`.
 */
export async function fetchRoadRoute(
  pickup: Location,
  destination: Location,
): Promise<RoadRouteResult> {
  const apiKey = process.env.EXPO_PUBLIC_ORS_API_KEY?.trim();
  if (__DEV__) {
    console.log("[TriGo Route] request", {
      keyPresent: Boolean(apiKey),
      pickup: formatPoint(pickup),
      destination: formatPoint(destination),
    });
  }
  if (!apiKey) {
    return { ok: false, reason: "unavailable" };
  }

  const first = await requestRoute(
    apiKey,
    buildGetRequest(apiKey, pickup, destination),
  );
  if (first.ok) {
    return first.route
      ? { ok: true, route: first.route }
      : { ok: false, reason: "unavailable" };
  }
  if (first.orsCode !== ORS_NO_ROUTABLE_POINT) {
    return { ok: false, reason: "unavailable" };
  }

  const retry = await requestRoute(
    apiKey,
    buildWideRadiusPostRequest(apiKey, pickup, destination),
  );
  return retry.ok && retry.route
    ? { ok: true, route: retry.route }
    : { ok: false, reason: "no_road_near_pin" };
}

/**
 * Road route between pickup and destination, or null on any failure (see fetchRoadRoute),
 * so callers can fall back to the straight-line distance.
 */
export async function getRoadRoute(
  pickup: Location,
  destination: Location,
): Promise<RoadRoute | null> {
  const result = await fetchRoadRoute(pickup, destination);
  return result.ok ? result.route : null;
}
