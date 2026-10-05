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

export function getVehicleOption(type: VehicleType): VehicleOption {
  return VEHICLE_OPTIONS.find((option) => option.type === type) ?? VEHICLE_OPTIONS[0];
}
