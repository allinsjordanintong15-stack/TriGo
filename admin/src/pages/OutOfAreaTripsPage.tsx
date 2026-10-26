import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { BOOKING_STATUS_LABELS, VEHICLE_TYPE_LABELS } from '../bookings/bookings';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime, formatIsoDay, formatPeso, formatTime, plural } from '../lib/format';
import { loadOutOfAreaTrips, type OutOfAreaTrip } from '../outOfArea/outOfAreaRequests';
import { defaultDateRange, parseDateRange } from '../lib/dateRange';
import {
  DEFAULT_RANGE_DAYS,
  DISPLAY_STATUS_LABELS,
  displayStatus,
  REQUEST_QUERY_LIMIT,
  type DisplayStatus,
} from '../outOfArea/requests';

type Filter = 'all' | DisplayStatus;

const FILTER_ORDER: DisplayStatus[] = ['searching', 'awaiting_passenger', 'confirmed', 'expired', 'cancelled', 'rejected'];

export function OutOfAreaTripsPage() {
  const [trips, setTrips] = useState<OutOfAreaTrip[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [truncated, setTruncated] = useState(false);
  // `draft` follows the date inputs; `applied` is the range the table shows (on createdAt).
  const [draft, setDraft] = useState(() => defaultDateRange(new Date(), DEFAULT_RANGE_DAYS));
  const [applied, setApplied] = useState(draft);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const range = parseDateRange(applied.from, applied.to);
    if ('error' in range) return; // applyRange never applies an invalid range
    setLoadError(null);
    try {
      const loaded = await loadOutOfAreaTrips(range);
      setTrips(loaded.trips);
      setTruncated(loaded.truncated);
      setLoadedAt(new Date());
    } catch {
      setLoadError('Could not load out-of-area trips. Check your connection and reload the page.');
    }
  }, [applied]);

  function applyRange(event: FormEvent) {
    event.preventDefault();
    const range = parseDateRange(draft.from, draft.to);
    if ('error' in range) {
      setRangeError(range.error);
      return;
    }
    setRangeError(null);
    setTrips(null);
    setApplied({ ...draft });
  }

  useEffect(() => {
    void reload();
  }, [reload]);

  // Expiry is judged at load time so the statuses and counts agree; Refresh updates both.
  const rows = useMemo(
    () => (trips ?? []).map((trip) => ({ trip, status: displayStatus(trip.request, loadedAt) })),
    [trips, loadedAt],
  );

  const counts = useMemo(() => {
    const result = new Map<DisplayStatus, number>();
    for (const row of rows) result.set(row.status, (result.get(row.status) ?? 0) + 1);
    return result;
  }, [rows]);

  const completedTrips = rows.filter((row) => row.trip.bookingStatus === 'completed').length;
  const filtered = filter === 'all' ? rows : rows.filter((row) => row.status === filter);

  return (
    <div className="stack">
      <PageHeader
        title="Out-of-area trips"
        subtitle="Trips starting or ending outside Trinidad. Fares use the per-km rate and are final."
        actions={
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        }
      />

      <div className="card">
        <form className="date-range-form" onSubmit={applyRange} noValidate>
          <label className="field" htmlFor="out-of-area-from">
            <span>Requested from</span>
            <input
              id="out-of-area-from"
              type="date"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => setDraft((range) => ({ ...range, from: e.target.value }))}
            />
          </label>
          <label className="field" htmlFor="out-of-area-to">
            <span>to</span>
            <input
              id="out-of-area-to"
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => setDraft((range) => ({ ...range, to: e.target.value }))}
            />
          </label>
          <button type="submit" className="btn-primary">
            Show
          </button>
        </form>
        {rangeError && (
          <div className="alert-error" role="alert">
            {rangeError}
          </div>
        )}
      </div>

      {loadError ? (
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      ) : !trips ? (
        <div className="card">
          <LoadingBlock label="Loading out-of-area trips…" lines={5} />
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <Stat label={truncated ? `Requests (latest ${REQUEST_QUERY_LIMIT})` : 'Requests'} value={rows.length} />
            <Stat label="Looking for a driver" value={counts.get('searching') ?? 0} />
            <Stat label="Waiting for passenger" value={counts.get('awaiting_passenger') ?? 0} />
            <Stat label="Confirmed" value={counts.get('confirmed') ?? 0} />
            <Stat label="Completed trips" value={completedTrips} />
            <Stat label="Expired" value={counts.get('expired') ?? 0} />
            <Stat label="Cancelled" value={counts.get('cancelled') ?? 0} />
          </div>

          <div className="card">
            <label className="field filter-field" htmlFor="out-of-area-filter">
              <span>Show</span>
              <select id="out-of-area-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                <option value="all">All requests ({rows.length})</option>
                {FILTER_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {DISPLAY_STATUS_LABELS[status]} ({counts.get(status) ?? 0})
                  </option>
                ))}
              </select>
            </label>
            <p className="muted small" aria-live="polite">
              {filter === 'all'
                ? `${plural(rows.length, 'request')} from ${formatIsoDay(applied.from)} to ${formatIsoDay(applied.to)}.`
                : `${filtered.length} of ${plural(rows.length, 'request')} from ${formatIsoDay(applied.from)} to ${formatIsoDay(applied.to)}.`}{' '}
              Statuses as of {formatTime(loadedAt)}.
            </p>
            {truncated && (
              <p className="alert-warning" role="status">
                Latest {REQUEST_QUERY_LIMIT} requests shown. Choose a shorter range to see older ones.
              </p>
            )}

            {filtered.length === 0 ? (
              <EmptyState>
                {rows.length === 0 ? 'No out-of-area requests in this date range.' : 'No requests with this status.'}
              </EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="data-table booking-table out-of-area-table">
                  <thead>
                    <tr>
                      <th scope="col">Requested</th>
                      <th scope="col">Passenger</th>
                      <th scope="col">Route</th>
                      <th scope="col" className="num">Fare</th>
                      <th scope="col">Driver</th>
                      <th scope="col">Request</th>
                      <th scope="col">Trip</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(({ trip, status }) => {
                      const { request } = trip;
                      return (
                        <tr key={request.requestId}>
                          <td>
                            <div>{formatDateTime(request.createdAt)}</div>
                            <div className="muted small mono" title="Request ID">
                              {request.requestId}
                            </div>
                          </td>
                          <td>
                            {request.passengerId ? (
                              <Link className="btn-link" to={`/passengers/${request.passengerId}`}>
                                {trip.passengerName || '(no name)'}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="route-cell">
                            <div>
                              <span className="muted small">From </span>
                              {request.pickupAddress || '—'}
                            </div>
                            <div>
                              <span className="muted small">To </span>
                              {request.destinationAddress || '—'}
                            </div>
                            <div className="muted small">
                              {[
                                request.vehicleType ? VEHICLE_TYPE_LABELS[request.vehicleType] : null,
                                request.distanceKm !== null ? `${request.distanceKm.toFixed(1)} km` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </td>
                          <td className="num">{formatPeso(request.fare)}</td>
                          <td>{trip.driverName === null ? <span className="muted">None</span> : trip.driverName || '(no name)'}</td>
                          <td>
                            <span className={`booking-status request-status-${status}`}>
                              {DISPLAY_STATUS_LABELS[status]}
                            </span>
                            {(status === 'searching' || status === 'awaiting_passenger') && (
                              <div className="muted small">Expires {formatDateTime(request.expiresAt)}</div>
                            )}
                          </td>
                          <td>
                            {trip.bookingStatus ? (
                              <span className={`booking-status booking-status-${trip.bookingStatus}`}>
                                {BOOKING_STATUS_LABELS[trip.bookingStatus]}
                              </span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="cell-action">
                            <Link className="btn-link" to={`/out-of-area/${request.requestId}`}>
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
