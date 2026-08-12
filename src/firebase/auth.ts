import { firebaseApp } from '@/firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  Auth,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';

let auth: Auth;

if (Platform.OS === 'web') {
  auth = getAuth(firebaseApp);
} else {
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(firebaseApp);
  }
}

export { auth };
