/**
 * The 19 barangays of Trinidad, Bohol other than Poblacion (mobile app copy). IDs are the
 * barangayTariffs/{barangayId} document IDs. Keep in sync with admin/src/tariffs/barangays.ts
 * and barangayNames() in firestore.rules (tests/barangays checks all three match).
 */
export const BARANGAYS = [
  { id: 'banlasan', name: 'Banlasan' },
  { id: 'bongbong', name: 'Bongbong' },
  { id: 'catoogan', name: 'Catoogan' },
  { id: 'guinobatan', name: 'Guinobatan' },
  { id: 'hinlayagan-ilaud', name: 'Hinlayagan Ilaud' },
  { id: 'hinlayagan-ilaya', name: 'Hinlayagan Ilaya' },
  { id: 'kauswagan', name: 'Kauswagan' },
  { id: 'kinan-oan', name: 'Kinan-oan' },
  { id: 'la-union', name: 'La Union' },
  { id: 'la-victoria', name: 'La Victoria' },
  { id: 'mabuhay-cabigohan', name: 'Mabuhay Cabigohan' },
  { id: 'mahagbu', name: 'Mahagbu' },
  { id: 'manuel-m-roxas', name: 'Manuel M. Roxas' },
  { id: 'san-isidro', name: 'San Isidro' },
  { id: 'san-vicente', name: 'San Vicente' },
  { id: 'santo-tomas', name: 'Santo Tomas' },
  { id: 'soom', name: 'Soom' },
  { id: 'tagum-norte', name: 'Tagum Norte' },
  { id: 'tagum-sur', name: 'Tagum Sur' },
] as const;

export type BarangayId = (typeof BARANGAYS)[number]['id'];

/** Poblacion (town center) has no tariff row; trips to/from it use the other barangay's tariff. */
export const POBLACION_ID = 'poblacion';

export type BoundaryBarangayId = BarangayId | typeof POBLACION_ID;
