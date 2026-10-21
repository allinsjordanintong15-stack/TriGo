import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { createContext, useContext } from 'react';

import { db } from '../firebase/config';

// Sidebar badges: work waiting for an admin, counted by Firestore (one count() each, no
// documents downloaded). AdminCountsProvider refreshes them on navigation at most every
// REFRESH_INTERVAL_MS, and immediately when a page calls refreshCounts() after an action
// that changes one.

export type AdminCounts = {
  /** commissionPayments with status 'pending' (Earnings). */
  pendingPayments: number;
  /** driverApplications with status 'pending' (Driver verification). */
  pendingApplications: number;
  /** complaints with status 'open' (Reports & Complaints). */
  openComplaints: number;
};

export const REFRESH_INTERVAL_MS = 15_000;

async function countWhere(collectionName: string, status: string): Promise<number> {
  const snapshot = await getCountFromServer(query(collection(db, collectionName), where('status', '==', status)));
  return snapshot.data().count;
}

export async function loadAdminCounts(): Promise<AdminCounts> {
  const [pendingPayments, pendingApplications, openComplaints] = await Promise.all([
    countWhere('commissionPayments', 'pending'),
    countWhere('driverApplications', 'pending'),
    countWhere('complaints', 'open'),
  ]);
  return { pendingPayments, pendingApplications, openComplaints };
}

export type AdminCountsState = {
  /** Null until the first load succeeds. */
  counts: AdminCounts | null;
  /** Reloads now, ignoring the interval (call after confirming, approving, etc.). */
  refreshCounts: () => void;
};

export const AdminCountsContext = createContext<AdminCountsState>({ counts: null, refreshCounts: () => {} });

export function useAdminCounts(): AdminCountsState {
  return useContext(AdminCountsContext);
}
