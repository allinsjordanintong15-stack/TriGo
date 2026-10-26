import { VehicleType } from '@/types';

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

export function getVehicleOption(type: VehicleType): VehicleOption {
  return VEHICLE_OPTIONS.find((option) => option.type === type) ?? VEHICLE_OPTIONS[0];
}
