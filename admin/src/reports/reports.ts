import {
  collection,
  count,
  getAggregateFromServer,
  getCountFromServer,
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
// summary). Commission is the commission actually recorded (commissions/*, dated by
// completedAt, the same server time as the trip's completion), not an estimate. Each query
// has a composite index in firestore.indexes.json; the explicit orderBy('…', 'desc')
// matches those indexes.

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
  /** Sum of commissions recorded in the range, in integer centavos. */
  recordedCommissionCentavos: number;
};

type Range = { start: Date; end: Date };

function inRange(field: string, range: Range): QueryConstraint[] {
  return [
    where(field, '>=', Timestamp.fromDate(range.start)),
    where(field, '<', Timestamp.fromDate(range.end)),
    orderBy(field, 'desc'),
  ];
}

/** Index: bookings (status, updatedAt DESC, finalFare DESC), or with bookingType first. */
export async function completedTrips(range: Range, bookingType?: 'standard' | 'out_of_area'): Promise<TypeRow> {
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
export async function cancelledBookings(range: Range): Promise<number> {
  const q = query(collection(db, 'bookings'), where('status', '==', 'cancelled'), ...inRange('updatedAt', range));
  return (await getCountFromServer(q)).data().count;
}

/** Index: commissions (completedAt DESC, amountCentavos DESC). Integer centavos. */
export async function recordedCommission(range: Range): Promise<number> {
  const q = query(collection(db, 'commissions'), ...inRange('completedAt', range));
  const snapshot = await getAggregateFromServer(q, { centavos: sum('amountCentavos') });
  // Integer centavos, so the sum is exact; rounding only guards against a stray float.
  return Math.round(snapshot.data().centavos ?? 0);
}

export async function loadReport(range: DateRange): Promise<Report> {
  const { granularity, periods } = buildPeriods(range);

  const [rows, standard, outOfArea, requestsSnap, passengersSnap, driversSnap, recordedCommissionCentavos] = await Promise.all([
    Promise.all(
      periods.map(async (period): Promise<PeriodRow> => {
        const [done, cancelled] = await Promise.all([completedTrips(period), cancelledBookings(period)]);
        return { period, completedTrips: done.trips, fares: done.fares, cancelledBookings: cancelled };
      }),
    ),
    completedTrips(range, 'standard'),
    completedTrips(range, 'out_of_area'),
    // Single-field index on createdAt (automatic).
    getCountFromServer(query(collection(db, 'outOfAreaRequests'), ...inRange('createdAt', range))),
    // Index: users (role, createdAt DESC).
    getCountFromServer(query(collection(db, 'users'), where('role', '==', 'passenger'), ...inRange('createdAt', range))),
    // Single-field index on isVerified (automatic).
    getCountFromServer(query(collection(db, 'drivers'), where('isVerified', '==', true))),
    recordedCommission(range),
  ]);

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
    recordedCommissionCentavos,
  };
}
