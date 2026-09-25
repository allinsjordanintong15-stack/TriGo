const REQUIRED_ENV_VARS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL: string;
}

function readFirebaseEnv(): { config: FirebaseEnvConfig; missing: string[] } {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  const config: FirebaseEnvConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
    databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  };

  return { config, missing };
}

const { config, missing } = readFirebaseEnv();

export const env = {
  firebase: {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    databaseURL: config.databaseURL,
  },
} as const;

/**
 * Diagnostics for the Firebase environment configuration.
 * Importing this module no longer throws, so the app can start and surface a
 * clear, actionable message instead of an unexplained crash when .env is missing.
 */
export const firebaseEnvStatus = {
  missingVars: missing,
  isValid: missing.length === 0,
  getMessage(): string {
    if (this.isValid) {
      return 'Firebase environment is configured.';
    }
    return (
      `Firebase is not fully configured. Missing environment variables: ${this.missingVars.join(', ')}.\n` +
      'Copy .env.example to .env and provide your Firebase project values before running the app.'
    );
  },
};
