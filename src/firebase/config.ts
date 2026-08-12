import { env } from '@/config/env';
import { FirebaseOptions, initializeApp } from 'firebase/app';

const firebaseConfig: FirebaseOptions = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  storageBucket: env.firebase.storageBucket,
  messagingSenderId: env.firebase.messagingSenderId,
  appId: env.firebase.appId,
  ...(env.firebase.databaseURL
    ? { databaseURL: env.firebase.databaseURL }
    : {}),
};

export const firebaseApp = initializeApp(firebaseConfig);
