import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { AdminCountsContext, loadAdminCounts, REFRESH_INTERVAL_MS, type AdminCounts } from '../lib/adminCounts';

export function AdminCountsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const lastLoadAt = useRef(0);

  const load = useCallback(async (force: boolean) => {
    const now = Date.now();
    if (!force && now - lastLoadAt.current < REFRESH_INTERVAL_MS) return;
    lastLoadAt.current = now;
    try {
      setCounts(await loadAdminCounts());
    } catch {
      // Badges are a convenience: keep the last counts and retry on a later navigation.
      lastLoadAt.current = 0;
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load, location.pathname]);

  const value = useMemo(() => ({ counts, refreshCounts: () => void load(true) }), [counts, load]);
  return <AdminCountsContext.Provider value={value}>{children}</AdminCountsContext.Provider>;
}
