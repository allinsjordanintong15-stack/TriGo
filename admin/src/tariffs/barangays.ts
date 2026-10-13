/**
 * The 19 barangays of Trinidad, Bohol other than Poblacion. Each has a fixed per-trip
 * tariff for trips between it and Poblacion. IDs are the barangayTariffs/{barangayId}
 * document IDs; firestore.rules accepts these IDs and names only (keep in sync).
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
