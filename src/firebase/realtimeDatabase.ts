import { env } from '@/config/env';
import { firebaseApp } from '@/firebase/config';
import { Database, getDatabase } from 'firebase/database';

let database: Database | null = null;

export function getRealtimeDatabase(): Database {
  if (!env.firebase.databaseURL) {
    throw new Error(
      'Firebase Realtime Database URL is not configured. Set EXPO_PUBLIC_FIREBASE_DATABASE_URL in .env.',
    );
  }

  if (!database) {
    database = getDatabase(firebaseApp);
  }

  return database;
}

export const REALTIME_PATHS = {
  driverLocation: (driverId: string) => `drivers/${driverId}/location`,
} as const;
