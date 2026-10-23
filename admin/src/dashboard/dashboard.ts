import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  type Query,
} from 'firebase/firestore';

import { readBooking, VEHICLE_TYPE_LABELS, type AdminBooking } from '../bookings/bookings';
import { commissionStatus } from '../earnings/commissionStatus';
import { readAccount } from '../earnings/earnings';
import { db } from '../firebase/config';
import { buildPeriods, type Period } from '../reports/reportMath';
import { cancelledBookings, completedTrips, recordedCommission } from '../reports/reports';

// Dashboard data. Each section has its own loader so the page can show them as they
// arrive. Days run midnight to midnight in the admin's local time, the same as Reports.
// Pending payments, applications and open complaints come from the sidebar badge counts
// (lib/adminCounts.ts), so they are not loaded again here.

/** Standard bookings never expire, so only recent pending ones count as open requests. */
export const OPEN_STANDARD_WINDOW_MS = 60 * 60 * 1000;

export const RECENT_BOOKINGS_LIMIT = 8;

export const CHART_DAYS = 7;

async function countOf(q: Query): Promise<number> {
  return (await getCountFromServer(q)).data().count;
}

// --- Needs attention: drivers behind on commission -------------------------------------

export type CommissionAlerts = { suspended: number; overdue: number };

/**
 * The status is never stored (it depends on the current time), so it can't be counted on
 * the server: this reads every commissionAccounts doc and applies commissionStatus.
 */
export async function loadCommissionAlerts(nowMillis = Date.now()): Promise<CommissionAlerts> {
  const snapshot = await getDocs(collection(db, 'commissionAccounts'));
  const alerts: CommissionAlerts = { suspended: 0, overdue: 0 };
  for (const d of snapshot.docs) {
    const account = readAccount(d.data());
    if (!account) continue;
    const { status } = commissionStatus(account, nowMillis);
    if (status === 'suspended' || status === 'overdue') alerts[status] += 1;
  }
  return alerts;
}

// --- Live now ---------------------------------------------------------------------------

export type LiveNow = {
  online: number;
  /** Online and available for new requests. */
  available: number;
  onTrip: number;
  openRequests: {
    /** Out-of-area requests still searching and not expired. */
    outOfArea: number;
    /** Standard bookings still pending, updated in the last OPEN_STANDARD_WINDOW_MS. */
    standard: number;
  };
};

export async function loadLiveNow(now = new Date()): Promise<LiveNow> {
  const drivers = collection(db, 'drivers');
  const nowStamp = Timestamp.fromDate(now);
  const [online, available, onTrip, standard, ...outOfAreaByType] = await Promise.all([
    // Equality-only filters: the automatic single-field indexes are enough.
    countOf(query(drivers, where('isOnline', '==', true))),
    countOf(query(drivers, where('isOnline', '==', true), where('isAvailable', '==', true))),
    countOf(query(drivers, where('currentBookingId', '!=', null))),
    // Index: bookings (status, updatedAt DESC).
    countOf(
      query(
        collection(db, 'bookings'),
        where('status', '==', 'pending'),
        where('updatedAt', '>=', Timestamp.fromMillis(now.getTime() - OPEN_STANDARD_WINDOW_MS)),
        orderBy('updatedAt', 'desc'),
      ),
    ),
    // Index: outOfAreaRequests (status, vehicleType, expiresAt), the one drivers use.
    ...Object.keys(VEHICLE_TYPE_LABELS).map((vehicleType) =>
      countOf(
        query(
          collection(db, 'outOfAreaRequests'),
          where('status', '==', 'searching'),
          where('vehicleType', '==', vehicleType),
          where('expiresAt', '>', nowStamp),
        ),
      ),
    ),
  ]);
  return {
    online,
    available,
    onTrip,
    openRequests: { outOfArea: outOfAreaByType.reduce((total, n) => total + n, 0), standard },
  };
}

// --- Last 7 days and today ----------------------------------------------------------------

export type DayRow = {
  period: Period;
  completedTrips: number;
  /** Sum of finalFare in pesos. */
  fares: number;
  /** Commission recorded that day, in integer centavos. */
  commissionCentavos: number;
};

export type RecentDays = {
  /** Oldest first; the last row is today. */
  days: DayRow[];
  /** Today's cancelled bookings (the other "Today" figures are the last day row). */
  cancelledToday: number;
};

export async function loadRecentDays(now = new Date()): Promise<RecentDays> {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (CHART_DAYS - 1));
  const { periods } = buildPeriods({ start, end: tomorrow });
  const today = periods[periods.length - 1];
  const [days, cancelledToday] = await Promise.all([
    Promise.all(
      periods.map(async (period): Promise<DayRow> => {
        const [done, commissionCentavos] = await Promise.all([completedTrips(period), recordedCommission(period)]);
        return { period, completedTrips: done.trips, fares: done.fares, commissionCentavos };
      }),
    ),
    cancelledBookings(today),
  ]);
  return { days, cancelledToday };
}

// --- Recent activity ------------------------------------------------------------------------

export type RecentBooking = {
  booking: AdminBooking;
  passengerName: string;
  driverName: string;
};

/** The newest bookings with passenger and driver names (each name read once). */
export async function loadRecentBookings(): Promise<RecentBooking[]> {
  // Single-field index on createdAt (automatic).
  const snapshot = await getDocs(
    query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(RECENT_BOOKINGS_LIMIT)),
  );
  const bookings = snapshot.docs.map((d) => readBooking(d.id, d.data()));

  const passengerIds = [...new Set(bookings.map((b) => b.passengerId).filter(Boolean))];
  const driverIds = [...new Set(bookings.map((b) => b.driverId).filter((id): id is string => !!id))];
  const fullName = async (path: 'users' | 'drivers', uid: string): Promise<[string, string]> => {
    const snap = await getDoc(doc(db, path, uid));
    const name = snap.data()?.fullName;
    return [uid, typeof name === 'string' ? name : ''];
  };
  const [passengerNames, driverNames] = await Promise.all([
    Promise.all(passengerIds.map((uid) => fullName('users', uid))).then((entries) => new Map(entries)),
    Promise.all(driverIds.map((uid) => fullName('drivers', uid))).then((entries) => new Map(entries)),
  ]);

  return bookings.map((booking) => ({
    booking,
    passengerName: passengerNames.get(booking.passengerId) ?? '',
    driverName: booking.driverId ? (driverNames.get(booking.driverId) ?? '') : '',
  }));
}

// --- Money summary --------------------------------------------------------------------------

export type MoneySummary = {
  /** Confirmed commission payments. */
  collectedCentavos: number;
  cashedOutCentavos: number;
  /** collected − cashed out. */
  availableCentavos: number;
};

/** earningsLedger/totals only (one read); outstanding commission is on the Earnings page. */
export async function loadMoneySummary(): Promise<MoneySummary> {
  const ledger = (await getDoc(doc(db, 'earningsLedger', 'totals'))).data();
  const collectedCentavos = typeof ledger?.collectedCentavos === 'number' ? ledger.collectedCentavos : 0;
  const cashedOutCentavos = typeof ledger?.cashedOutCentavos === 'number' ? ledger.cashedOutCentavos : 0;
  return { collectedCentavos, cashedOutCentavos, availableCentavos: collectedCentavos - cashedOutCentavos };
}
