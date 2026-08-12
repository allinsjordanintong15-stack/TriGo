import { FareSettings } from '@/types';

export const DEFAULT_FARE_SETTINGS: FareSettings = {
  tricycle: {
    baseFare: 15,
    perKm: 8,
  },
  motorcycle: {
    baseFare: 10,
    perKm: 6,
  },
};

export const APP_NAME = 'TriGo';

export const PASSENGER_ROLE = 'passenger' as const;
