import {
  CommissionServiceError,
  CommissionSettings,
  getCommissionAccount,
  getCommissionSettings,
} from '@/services/commissionService';
import { CommissionAccountTimes } from '@/utils/commission';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export interface CommissionAccountState {
  loading: boolean;
  /** Shown instead of the account when loading failed. */
  error: string;
  /** Null when the admin has not set a commission. */
  settings: CommissionSettings | null;
  /** Null before the driver's first commission. */
  account: CommissionAccountTimes | null;
}

/**
 * The driver's commission account and the current settings (Home and Earnings). Read-only;
 * refreshed whenever the screen gains focus, so a just-completed trip is included.
 */
export function useCommissionAccount(driverId: string | null): CommissionAccountState {
  const [state, setState] = useState<CommissionAccountState>({
    loading: true,
    error: '',
    settings: null,
    account: null,
  });

  useFocusEffect(
    useCallback(() => {
      if (!driverId) return;
      let active = true;

      Promise.all([getCommissionSettings(), getCommissionAccount(driverId)])
        .then(([settings, account]) => {
          if (active) setState({ loading: false, error: '', settings, account });
        })
        .catch((err) => {
          if (!active) return;
          setState((current) => ({
            ...current,
            loading: false,
            error:
              err instanceof CommissionServiceError
                ? err.message
                : 'Unable to load your commission. Please try again.',
          }));
        });

      return () => {
        active = false;
      };
    }, [driverId]),
  );

  return state;
}
