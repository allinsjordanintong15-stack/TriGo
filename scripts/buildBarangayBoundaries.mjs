// Generates src/constants/barangayBoundaries.ts from data/trinidad-barangays.geojson
// (PSA/NAMRIA adm4 v03 via OCHA HDX), keyed by the TriGo barangay IDs.
// Run by hand after replacing the GeoJSON: node scripts/buildBarangayBoundaries.mjs
// Fails on any unknown, missing or duplicate barangay or unexpected geometry.
// Also computes each barangay's interior point (the default pin for a barangay search result).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { distanceToPolygonEdgeMeters, isInsidePolygon } from '../src/utils/polygon.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'data/trinidad-barangays.geojson');
const outputPath = resolve(root, 'src/constants/barangayBoundaries.ts');

// Same IDs as src/constants/barangays.ts (plus Poblacion); tests/barangays checks the lists.
const KNOWN_IDS = [
  'poblacion',
  'banlasan',
  'bongbong',
  'catoogan',
  'guinobatan',
  'hinlayagan-ilaud',
  'hinlayagan-ilaya',
  'kauswagan',
  'kinan-oan',
  'la-union',
  'la-victoria',
  'mabuhay-cabigohan',
  'mahagbu',
  'manuel-m-roxas',
  'san-isidro',
  'san-vicente',
  'santo-tomas',
  'soom',
  'tagum-norte',
  'tagum-sur',
];

/** "Manuel M. Roxas" -> "manuel-m-roxas"; "Poblacion (Pob.)" -> "poblacion". */
function toId(name) {
  return name
    .toLowerCase()
    .replace(/\(pob\.?\)/g, '')
    .replace(/[.\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const round = (value) => Math.round(value * 1e5) / 1e5;

const METERS_PER_DEGREE_LAT = 111_320;
/** Stop refining once no cell can beat the best point by more than this. */
const INTERIOR_POINT_PRECISION_M = 1;

/**
 * Pole of inaccessibility ("polylabel"): the point inside the ring farthest from its edge,
 * found by subdividing square cells. Unlike the centroid it is always inside, and far from
 * neighbouring barangays. Distances in metres; returns [lat, lon] rounded to 5 decimals.
 */
function interiorPoint(ring) {
  const signedDistance = (lat, lon) =>
    (isInsidePolygon(lat, lon, ring) ? 1 : -1) * distanceToPolygonEdgeMeters(lat, lon, ring);
  // half: half the cell size in degrees. A degree of latitude is the longer side in metres,
  // so `max` is an upper bound on the distance anywhere in the cell.
  const cell = (lat, lon, half) => {
    const distance = signedDistance(lat, lon);
    return { lat, lon, half, distance, max: distance + half * Math.SQRT2 * METERS_PER_DEGREE_LAT };
  };

  const lats = ring.map(([lat]) => lat);
  const lons = ring.map(([, lon]) => lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const size = Math.min(maxLat - minLat, maxLon - minLon);

  const queue = [];
  for (let lat = minLat; lat < maxLat; lat += size) {
    for (let lon = minLon; lon < maxLon; lon += size) {
      queue.push(cell(lat + size / 2, lon + size / 2, size / 2));
    }
  }

  let best = cell((minLat + maxLat) / 2, (minLon + maxLon) / 2, 0);
  while (queue.length > 0) {
    let index = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].max > queue[index].max) index = i;
    const [current] = queue.splice(index, 1);

    if (current.distance > best.distance) best = current;
    if (current.max - best.distance <= INTERIOR_POINT_PRECISION_M) continue;

    const half = current.half / 2;
    for (const [dLat, dLon] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      queue.push(cell(current.lat + dLat * half, current.lon + dLon * half, half));
    }
  }

  return [round(best.lat), round(best.lon)];
}

const geojson = JSON.parse(readFileSync(sourcePath, 'utf8'));
const errors = [];
const byId = new Map();

for (const feature of geojson.features) {
  const { adm4_name: name, adm4_pcode: pcode } = feature.properties;
  const id = toId(name);

  if (!KNOWN_IDS.includes(id)) errors.push(`Unknown barangay "${name}" (${pcode}) -> "${id}"`);
  if (byId.has(id)) errors.push(`Duplicate barangay "${name}" (${pcode})`);
  if (feature.geometry.type !== 'Polygon' || feature.geometry.coordinates.length !== 1) {
    errors.push(`"${name}" is not a single-ring Polygon`);
  }

  byId.set(id, {
    id,
    name: id === 'poblacion' ? 'Poblacion' : name,
    psgcCode: pcode.replace(/^PH/, ''),
    // GeoJSON is [lon, lat]; the app stores [lat, lon] like TRIGO_SERVICE_AREA.boundary.
    boundary: feature.geometry.coordinates[0].map(([lon, lat]) => [round(lat), round(lon)]),
  });
}

for (const id of KNOWN_IDS) {
  if (!byId.has(id)) errors.push(`Missing barangay "${id}"`);
}
if (geojson.features.length !== KNOWN_IDS.length) {
  errors.push(`Expected ${KNOWN_IDS.length} features, found ${geojson.features.length}`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

for (const area of byId.values()) {
  area.interiorPoint = interiorPoint(area.boundary);
  const [lat, lon] = area.interiorPoint;
  if (!isInsidePolygon(lat, lon, area.boundary)) {
    errors.push(`Interior point of "${area.id}" is outside its boundary`);
  }
  const edgeMeters = Math.round(distanceToPolygonEdgeMeters(lat, lon, area.boundary));
  console.log(`${area.id}: interior point [${lat}, ${lon}], ${edgeMeters} m from the edge`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const entries = KNOWN_IDS.map((id) => {
  const { name, psgcCode, boundary, interiorPoint: [lat, lon] } = byId.get(id);
  const points = boundary.map(([pointLat, pointLon]) => `[${pointLat}, ${pointLon}]`).join(', ');
  return `  {\n    id: '${id}',\n    name: '${name}',\n    psgcCode: '${psgcCode}',\n    interiorPoint: [${lat}, ${lon}],\n    boundary: [${points}],\n  },`;
});

const output = `// GENERATED by scripts/buildBarangayBoundaries.mjs from data/trinidad-barangays.geojson.
// Do not edit by hand; replace the GeoJSON and re-run the script.
//
// Barangay boundaries of Trinidad, Bohol: Philippines Subnational Administrative Boundaries
// (adm4, version v03, valid from 2025-02-13), PSA/NAMRIA via OCHA HDX. Each boundary is a
// closed ring of [latitude, longitude] vertices rounded to 5 decimals (~1 m). IDs match
// src/constants/barangays.ts, plus 'poblacion'. interiorPoint is the point inside the
// boundary farthest from its edge (pole of inaccessibility), the default barangay pin.

export const BARANGAY_BOUNDARIES = [
${entries.join('\n')}
] as const satisfies readonly {
  id: string;
  name: string;
  psgcCode: string;
  interiorPoint: readonly [number, number];
  boundary: readonly (readonly [number, number])[];
}[];
`;

writeFileSync(outputPath, output);
console.log(`Wrote ${KNOWN_IDS.length} barangay boundaries to ${outputPath}`);
