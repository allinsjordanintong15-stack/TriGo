import { formatNearbyLabel } from '@/utils/formatLocationLabel';

/**
 * Reverse geocoding through the OpenRouteService (Pelias) API, used when the device
 * geocoder has no street, place name or barangay for a point.
 * https://openrouteservice.org/dev/#/api-docs/geocode/reverse/get
 */
const ORS_REVERSE_URL = 'https://api.openrouteservice.org/geocode/reverse';
const ORS_REVERSE_LAYERS = 'address,street,venue,neighbourhood,locality';
const GEOCODE_TIMEOUT_MS = 8000;

interface NearbyPlace {
  name: string | null;
  locality: string | null;
}

// Nearby places by coordinates rounded to 4 decimals (~11 m), so the same spot is looked
// up once. Null means ORS answered but had nothing usable; failed requests are not cached.
const placeCache = new Map<string, NearbyPlace | null>();

function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

/** Name and locality of the first feature of an ORS reverse geocode response. */
function parseNearbyPlace(body: unknown): NearbyPlace | null {
  if (!isRecord(body) || !Array.isArray(body.features)) {
    return null;
  }

  const feature: unknown = body.features[0];
  if (!isRecord(feature) || !isRecord(feature.properties)) {
    return null;
  }

  const properties = feature.properties;
  const locality =
    readString(properties, 'locality') ??
    readString(properties, 'localadmin') ??
    readString(properties, 'county');
  return { name: readString(properties, 'name'), locality };
}

function toLabel(place: NearbyPlace | null, town: string | undefined): string | null {
  return place ? formatNearbyLabel(place.name, town ?? place.locality) : null;
}

/** Error text from an ORS error body, without anything from the request URL. */
function parseErrorMessage(body: unknown): unknown {
  if (!isRecord(body)) {
    return null;
  }
  if (body.error !== undefined) {
    return body.error;
  }
  return isRecord(body.geocoding) ? body.geocoding.errors : null;
}

/**
 * Nearby place label for a point, e.g. "Near Kinan-oan, Trinidad". Returns null when
 * no ORS key is configured, on any failure, or when ORS has no named place nearby.
 * `town` replaces ORS's locality, whose admin areas can disagree with ours near borders.
 */
export async function reverseGeocodeWithOrs(
  latitude: number,
  longitude: number,
  town?: string,
): Promise<string | null> {
  const key = cacheKey(latitude, longitude);
  if (placeCache.has(key)) {
    return toLabel(placeCache.get(key) ?? null, town);
  }

  const apiKey = process.env.EXPO_PUBLIC_ORS_API_KEY?.trim();
  if (!apiKey) {
    if (__DEV__) {
      console.warn('[TriGo Geocode] ORS key present: false');
    }
    return null;
  }

  const url =
    `${ORS_REVERSE_URL}?api_key=${encodeURIComponent(apiKey)}` +
    `&point.lon=${longitude}&point.lat=${latitude}&size=1&layers=${ORS_REVERSE_LAYERS}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  try {
    // The URL carries the key: never log it.
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);

    if (response.status !== 200) {
      if (__DEV__) {
        console.warn('[TriGo Geocode] ORS error', {
          status: response.status,
          error: parseErrorMessage(body),
        });
      }
      return null;
    }

    const place = parseNearbyPlace(body);
    const label = toLabel(place, town);
    if (__DEV__) {
      console.log('[TriGo Geocode] ORS 200', { ...place, town, label });
    }
    placeCache.set(key, place);
    return label;
  } catch (error) {
    if (__DEV__) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[TriGo Geocode] ORS request failed:', message.split(apiKey).join('<key>'));
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
