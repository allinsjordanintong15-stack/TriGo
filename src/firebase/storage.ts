import { firebaseApp } from '@/firebase/config';
import { FirebaseStorage, getStorage } from 'firebase/storage';

/** Cloud Storage for the configured bucket (EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET). */
export const storage: FirebaseStorage = getStorage(firebaseApp);

export const STORAGE_PATHS = {
  /** Driver application documents: driverApplications/{uid}/{orCr | ltoLicense}. */
  driverApplicationDocument: (uid: string, documentType: string) =>
    `driverApplications/${uid}/${documentType}`,
} as const;
