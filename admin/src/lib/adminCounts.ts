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
  /** complaints with status 'open' (Complaints; the sum of the two below). */
  openComplaints: number;
  /** Open complaints reported by passengers (Complaints → Against drivers). */
  openComplaintsAgainstDrivers: number;
  /** Open complaints reported by drivers (Complaints → Against passengers). */
  openComplaintsAgainstPassengers: number;
  /** deletionRequests with status 'pending' (Account deletion). */
  pendingDeletions: number;
};

export const REFRESH_INTERVAL_MS = 15_000;

async function countWhere(collectionName: string, status: string): Promise<number> {
  const snapshot = await getCountFromServer(query(collection(db, collectionName), where('status', '==', status)));
  return snapshot.data().count;
}

/** Open complaints from one kind of reporter (equality filters only: no composite index). */
async function openComplaintsFrom(reporterRole: 'passenger' | 'driver'): Promise<number> {
  const snapshot = await getCountFromServer(
    query(collection(db, 'complaints'), where('reporterRole', '==', reporterRole), where('status', '==', 'open')),
  );
  return snapshot.data().count;
}

export async function loadAdminCounts(): Promise<AdminCounts> {
  const [pendingPayments, pendingApplications, againstDrivers, againstPassengers, pendingDeletions] =
    await Promise.all([
      countWhere('commissionPayments', 'pending'),
      countWhere('driverApplications', 'pending'),
      openComplaintsFrom('passenger'),
      openComplaintsFrom('driver'),
      countWhere('deletionRequests', 'pending'),
    ]);
  return {
    pendingPayments,
    pendingApplications,
    // reporterRole is required by firestore.rules, so the two parts cover every complaint.
    openComplaints: againstDrivers + againstPassengers,
    openComplaintsAgainstDrivers: againstDrivers,
    openComplaintsAgainstPassengers: againstPassengers,
    pendingDeletions,
  };
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
