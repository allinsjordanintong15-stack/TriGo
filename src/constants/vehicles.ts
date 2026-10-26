import { DriverRecord, VehicleType } from '@/types';

export interface VehicleOption {
  type: VehicleType;
  label: string;
  icon: string;
}

export const VEHICLE_OPTIONS: VehicleOption[] = [
  { type: 'tricycle', label: 'Tricycle', icon: '🛺' },
  { type: 'motorcycle', label: 'Motorcycle', icon: '🏍️' },
];

/** Color choices in the driver application; "Other" lets the applicant type any color. */
export const VEHICLE_COLORS = [
  'White',
  'Black',
  'Silver',
  'Gray',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Orange',
  'Maroon',
  'Brown',
] as const;

/**
 * "Red Honda TMX 155", or null unless color, brand and model are all known (drivers approved
 * before they were recorded), so screens can fall back to the vehicle type.
 */
export function formatVehicleDescription(
  vehicle: Pick<DriverRecord, 'vehicleBrand' | 'vehicleModel' | 'vehicleColor'>,
): string | null {
  const { vehicleColor, vehicleBrand, vehicleModel } = vehicle;
  if (!vehicleColor || !vehicleBrand || !vehicleModel) return null;
  return `${vehicleColor} ${vehicleBrand} ${vehicleModel}`;
}

export function getVehicleOption(type: VehicleType): VehicleOption {
  return VEHICLE_OPTIONS.find((option) => option.type === type) ?? VEHICLE_OPTIONS[0];
}
