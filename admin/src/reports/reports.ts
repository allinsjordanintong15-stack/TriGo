import {
  collection,
  count,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  orderBy,
  query,
  sum,
  Timestamp,
  where,
  type QueryConstraint,
} from 'firebase/firestore';

import { db } from '../firebase/config';
import type { DateRange } from '../lib/dateRange';
import { buildPeriods, roundPeso, type Granularity, type Period } from './reportMath';

// Reports & Analytics: server-side count/sum aggregates only, so no booking documents are
// downloaded. A completed or cancelled booking is dated by updatedAt, which is set when it
// is completed or cancelled and never changes afterwards (same as the driver app's fares
// summary). Each query has a composite index in firestore.indexes.json; the explicit
// orderBy('…', 'desc') matches those indexes.

export type PeriodRow = {
  period: Period;
  completedTrips: number;
  /** Sum of finalFare on completed trips. */
  fares: number;
  cancelledBookings: number;
};

export type TypeRow = { trips: number; fares: number };

export type Report = {
  granularity: Granularity;
  rows: PeriodRow[];
  totals: { completedTrips: number; fares: number; cancelledBookings: number };
  byType: { standard: TypeRow; outOfArea: TypeRow };
  outOfAreaRequests: number;
  newPassengers: number;
  /** Current count, not limited to the range. */
  verifiedDrivers: number;
  /** commissionSettings/active.percentage, or null when not saved yet. */
  commissionPercentage: number | null;
};

function inRange(field: string, range: { start: Date; end: Date }): QueryConstraint[] {
  return [
    where(field, '>=', Timestamp.fromDate(range.start)),
    where(field, '<', Timestamp.fromDate(range.end)),
    orderBy(field, 'desc'),
  ];
}

/** Index: bookings (status, updatedAt DESC, finalFare DESC), or with bookingType first. */
async function completed(range: { start: Date; end: Date }, bookingType?: 'standard' | 'out_of_area'): Promise<TypeRow> {
  const constraints = [
    ...(bookingType ? [where('bookingType', '==', bookingType)] : []),
    where('status', '==', 'completed'),
    ...inRange('updatedAt', range),
  ];
  const snapshot = await getAggregateFromServer(query(collection(db, 'bookings'), ...constraints), {
    trips: count(),
    fares: sum('finalFare'),
  });
  const { trips, fares } = snapshot.data();
  return { trips, fares: roundPeso(fares ?? 0) };
}

/** Index: bookings (status, updatedAt DESC). */
async function cancelled(range: { start: Date; end: Date }): Promise<number> {
  const q = query(collection(db, 'bookings'), where('status', '==', 'cancelled'), ...inRange('updatedAt', range));
  return (await getCountFromServer(q)).data().count;
}

export async function loadReport(range: DateRange): Promise<Report> {
  const { granularity, periods } = buildPeriods(range);

  const [rows, standard, outOfArea, requestsSnap, passengersSnap, driversSnap, commissionSnap] = await Promise.all([
    Promise.all(
      periods.map(async (period): Promise<PeriodRow> => {
        const [done, cancelledBookings] = await Promise.all([completed(period), cancelled(period)]);
        return { period, completedTrips: done.trips, fares: done.fares, cancelledBookings };
      }),
    ),
    completed(range, 'standard'),
    completed(range, 'out_of_area'),
    // Single-field index on createdAt (automatic).
    getCountFromServer(query(collection(db, 'outOfAreaRequests'), ...inRange('createdAt', range))),
    // Index: users (role, createdAt DESC).
    getCountFromServer(query(collection(db, 'users'), where('role', '==', 'passenger'), ...inRange('createdAt', range))),
    // Single-field index on isVerified (automatic).
    getCountFromServer(query(collection(db, 'drivers'), where('isVerified', '==', true))),
    getDoc(doc(db, 'commissionSettings', 'active')),
  ]);

  const percentage = commissionSnap.data()?.percentage;
  return {
    granularity,
    rows,
    totals: {
      completedTrips: rows.reduce((total, row) => total + row.completedTrips, 0),
      fares: roundPeso(rows.reduce((total, row) => total + row.fares, 0)),
      cancelledBookings: rows.reduce((total, row) => total + row.cancelledBookings, 0),
    },
    byType: { standard, outOfArea },
    outOfAreaRequests: requestsSnap.data().count,
    newPassengers: passengersSnap.data().count,
    verifiedDrivers: driversSnap.data().count,
    commissionPercentage: typeof percentage === 'number' ? percentage : null,
  };
}
