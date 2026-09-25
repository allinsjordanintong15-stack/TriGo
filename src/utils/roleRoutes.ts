import { MobileUserRole, UserRole } from '@/types';
import { Href } from 'expo-router';

export const PASSENGER_HOME_HREF = '/home' satisfies Href;
export const DRIVER_HOME_HREF = '/driver/home' satisfies Href;

export function isMobileUserRole(role: UserRole | null | undefined): role is MobileUserRole {
  return role === 'passenger' || role === 'driver';
}

/** Landing screen for a signed-in role, or the login screen when the role has no mobile UI. */
export function getRoleHomeHref(role: UserRole | null | undefined): Href {
  if (role === 'passenger') return PASSENGER_HOME_HREF;
  if (role === 'driver') return DRIVER_HOME_HREF;
  return '/(auth)/login';
}
