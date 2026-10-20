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

export interface CommissionAccount extends CommissionAccountState {
  /** Loads again, e.g. after submitting a payment. */
  reload: () => void;
}

/**
 * The driver's commission account and the current settings (Home and Earnings). Refreshed
 * whenever the screen gains focus, so a just-completed trip is included, and on reload().
 */
export function useCommissionAccount(driverId: string | null): CommissionAccount {
  const [state, setState] = useState<CommissionAccountState>({
    loading: true,
    error: '',
    settings: null,
    account: null,
  });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

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
    }, [driverId, version]),
  );

  return { ...state, reload };
}
