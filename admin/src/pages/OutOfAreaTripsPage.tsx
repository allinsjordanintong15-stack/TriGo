import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  BOOKING_STATUS_LABELS,
  formatDateTime,
  formatPesoOrDash,
  VEHICLE_TYPE_LABELS,
} from '../bookings/bookings';
import { loadOutOfAreaTrips, type OutOfAreaTrip } from '../outOfArea/outOfAreaRequests';
import { DISPLAY_STATUS_LABELS, displayStatus, type DisplayStatus } from '../outOfArea/requests';

type Filter = 'all' | DisplayStatus;

const FILTER_ORDER: DisplayStatus[] = ['searching', 'awaiting_passenger', 'confirmed', 'expired', 'cancelled', 'rejected'];

export function OutOfAreaTripsPage() {
  const [trips, setTrips] = useState<OutOfAreaTrip[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const loaded = await loadOutOfAreaTrips();
      setTrips(loaded);
      setLoadedAt(new Date());
    } catch {
      setLoadError('Could not load out-of-area trips. Check your connection and reload the page.');
    }
  }, []);

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
      <div className="card">
        <div className="card-header">
          <h2>Out-of-area trips</h2>
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Requests for trips with a pickup or destination outside Trinidad, and the trip each confirmed request
          became. The fare is the per-km fare and is final. Read-only.
        </p>
      </div>

      {loadError ? (
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      ) : !trips ? (
        <div className="card muted">Loading out-of-area trips…</div>
      ) : (
        <>
          <div className="stat-grid">
            <Stat label="Requests" value={rows.length} />
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
                ? `${rows.length} requests. Statuses as of ${loadedAt.toLocaleTimeString()}.`
                : `${filtered.length} of ${rows.length} requests. Statuses as of ${loadedAt.toLocaleTimeString()}.`}
            </p>

            {filtered.length === 0 ? (
              <p className="muted">{rows.length === 0 ? 'No out-of-area requests yet.' : 'No requests with this status.'}</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table booking-table out-of-area-table">
                  <thead>
                    <tr>
                      <th scope="col">Requested</th>
                      <th scope="col">Passenger</th>
                      <th scope="col">Route</th>
                      <th scope="col">Fare</th>
                      <th scope="col">Driver</th>
                      <th scope="col">Request</th>
                      <th scope="col">Trip</th>
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
                          <td>{formatPesoOrDash(request.fare)}</td>
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
