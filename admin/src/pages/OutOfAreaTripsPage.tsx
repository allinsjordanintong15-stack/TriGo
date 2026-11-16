import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { VEHICLE_TYPE_LABELS } from '../bookings/bookings';
import { Avatar } from '../components/Avatar';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { pageSlice, readDriverPage } from '../drivers/driverTable';
import { defaultDateRange, parseDateRange } from '../lib/dateRange';
import { formatCount, formatDate, formatDateTime, formatIsoDay, formatPeso, formatTime, plural } from '../lib/format';
import { listLoadErrorMessage } from '../lib/loadError';
import { loadOutOfAreaTrips, type OutOfAreaTrip } from '../outOfArea/outOfAreaRequests';
import { DEFAULT_RANGE_DAYS, displayStatus, REQUEST_QUERY_LIMIT } from '../outOfArea/requests';
import {
  chipLabel,
  DEFAULT_TRIP_FILTERS,
  hasTripFilters,
  matchesTripSearch,
  RANGE_PRESETS,
  readTripFilters,
  statusCounts,
  TRIP_PAGE_SIZES,
  TRIP_STATUS_LABELS,
  tripStatus,
  tripTableParams,
  visibleChips,
  type RangePreset,
  type TripFilters,
  type TripPageSize,
  type TripStatus,
} from '../outOfArea/tripsTable';

const COLUMN_COUNT = 7;

type Row = { trip: OutOfAreaTrip; status: TripStatus };

/** The from/to days the filters stand for (custom days missing → the default range). */
function rangeFor(filters: TripFilters, now: Date): { from: string; to: string } {
  const preset = RANGE_PRESETS.find((p) => p.value === filters.preset);
  if (preset?.days) return defaultDateRange(now, preset.days);
  const fallback = defaultDateRange(now, DEFAULT_RANGE_DAYS);
  return { from: filters.from || fallback.from, to: filters.to || fallback.to };
}

/** /trips/out-of-area: requests opened in the date range, one row per trip. */
export function OutOfAreaTripsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readTripFilters(searchParams), [searchParams]);
  const requestedPage = readDriverPage(searchParams);
  const { from, to } = rangeFor(filters, new Date());
  const range = useMemo(() => parseDateRange(from, to), [from, to]);
  const rangeError = 'error' in range ? range.error : null;

  const [loaded, setLoaded] = useState<{ trips: OutOfAreaTrip[]; truncated: boolean; at: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if ('error' in range) return;
    setLoadError(null);
    setLoaded(null);
    try {
      const result = await loadOutOfAreaTrips(range);
      setLoaded({ trips: result.trips, truncated: result.truncated, at: new Date() });
    } catch (error) {
      setLoadError(listLoadErrorMessage(error, 'Could not load out-of-area trips. Check your connection and try again.'));
    }
  }, [range]);

  // A new preset or date loads the list at once (no separate Show button).
  useEffect(() => {
    void reload();
  }, [reload]);

  // Expiry is judged at load time so statuses and counts agree; Refresh updates both.
  const rows = useMemo<Row[]>(
    () =>
      loaded
        ? loaded.trips.map((trip) => ({
            trip,
            status: tripStatus(displayStatus(trip.request, loaded.at), trip.bookingStatus),
          }))
        : [],
    [loaded],
  );
  // Chip counts follow the search, so each chip says how many rows it would show.
  const searched = useMemo(
    () => rows.filter((row) => matchesTripSearch(row.trip.passengerName, row.trip.driverName, filters.search)),
    [rows, filters.search],
  );
  const counts = useMemo(() => statusCounts(searched.map((row) => row.status)), [searched]);
  const filtered = filters.status === 'all' ? searched : searched.filter((row) => row.status === filters.status);
  const slice = pageSlice(filtered, requestedPage, filters.pageSize);

  function update(next: TripFilters, page: number, replace = false) {
    setSearchParams(tripTableParams(next, page), { replace });
  }

  function choosePreset(preset: RangePreset) {
    // Custom starts from the range shown now, so the dates are never empty.
    update(preset === 'custom' ? { ...filters, preset, from, to } : { ...filters, preset, from: '', to: '' }, 1);
  }

  const clearFilters = () => update({ ...filters, search: '', status: DEFAULT_TRIP_FILTERS.status }, 1);

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

      <div className="card list-card">
        <div className="list-toolbar">
          <div className="segmented" role="group" aria-label="Requested in">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className="segmented-button"
                aria-pressed={filters.preset === preset.value}
                onClick={() => choosePreset(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {filters.preset === 'custom' && (
            <div className="custom-range">
              <label className="list-select" htmlFor="trips-from">
                <span>From</span>
                <input
                  id="trips-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => update({ ...filters, from: e.target.value, to }, 1, true)}
                />
              </label>
              <label className="list-select" htmlFor="trips-to">
                <span>To</span>
                <input
                  id="trips-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => update({ ...filters, from, to: e.target.value }, 1, true)}
                />
              </label>
            </div>
          )}
        </div>

        <div className="list-toolbar">
          <label className="list-search" htmlFor="trips-search">
            <span className="visually-hidden">Search passenger or driver name</span>
            <input
              id="trips-search"
              type="search"
              value={filters.search}
              onChange={(e) => update({ ...filters, search: e.target.value }, 1, true)}
              placeholder="Search passenger or driver name"
              autoComplete="off"
            />
          </label>
          <label className="list-select" htmlFor="trips-rows">
            <span>Show</span>
            <select
              id="trips-rows"
              value={filters.pageSize}
              onChange={(e) => update({ ...filters, pageSize: Number(e.target.value) as TripPageSize }, 1)}
            >
              {TRIP_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span className="list-count muted small" aria-live="polite">
            {rangeError
              ? ''
              : loaded
                ? `${plural(filtered.length, 'trip')} · ${formatIsoDay(from)}${from === to ? '' : ` – ${formatIsoDay(to)}`} · as of ${formatTime(loaded.at)}`
                : loadError
                  ? ''
                  : 'Loading…'}
          </span>
        </div>

        <div className="status-chips" role="group" aria-label="Status">
          {visibleChips(counts, filters.status).map((chip) => (
            <button
              key={chip}
              type="button"
              className={`status-chip${counts[chip] === 0 ? ' is-empty' : ''}`}
              aria-pressed={filters.status === chip}
              onClick={() => update({ ...filters, status: chip }, 1)}
            >
              {chipLabel(chip)} <span className="status-chip-count">{loaded ? formatCount(counts[chip]) : '–'}</span>
            </button>
          ))}
        </div>

        {rangeError ? (
          <div className="list-error" role="alert">
            <p>{rangeError}</p>
          </div>
        ) : loadError ? (
          <div className="list-error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="btn-outline" onClick={() => void reload()}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {loaded?.truncated && (
              <p className="alert-warning" role="status">
                Latest {REQUEST_QUERY_LIMIT} requests shown. Choose a shorter range to see older ones.
              </p>
            )}
            <div className="list-table-scroll">
              <table className="list-table trips-table">
                <colgroup>
                  <col className="col-requested" />
                  <col className="col-passenger" />
                  <col className="col-route" />
                  <col className="col-fare" />
                  <col className="col-trip-driver" />
                  <col className="col-trip-status" />
                  <col className="col-chevron" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Requested</th>
                    <th scope="col">Passenger</th>
                    <th scope="col">Route</th>
                    <th scope="col" className="num">
                      Fare
                    </th>
                    <th scope="col">Driver</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="visually-hidden">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!loaded ? (
                    <SkeletonRows count={filters.pageSize} />
                  ) : slice.items.length === 0 ? (
                    <tr className="list-empty-row">
                      <td colSpan={COLUMN_COUNT}>
                        <div className="empty-state">
                          No out-of-area trips in this period.{' '}
                          {hasTripFilters(filters) && (
                            <button type="button" className="link-button" onClick={clearFilters}>
                              Clear filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    slice.items.map((row) => (
                      <TripRow
                        key={row.trip.request.requestId}
                        row={row}
                        onOpen={() => navigate(`/trips/out-of-area/${row.trip.request.requestId}`)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {loaded && slice.total > 0 && (
              <div className="list-pager">
                <span className="muted small">
                  Showing {formatCount(slice.from)}–{formatCount(slice.to)} of {formatCount(slice.total)}
                </span>
                <Pagination
                  page={slice.page}
                  pageCount={slice.pageCount}
                  onChange={(page) => update(filters, page)}
                  label="Trip pages"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: Math.min(count, 10) }, (_, index) => (
        <tr key={index} className="list-skeleton-row" aria-hidden="true">
          {Array.from({ length: COLUMN_COUNT }, (__, cell) => (
            <td key={cell}>{cell < COLUMN_COUNT - 1 && <div className="skeleton-line" />}</td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Links inside the row handle their own clicks (the row would open the trip). */
function stop(event: MouseEvent) {
  event.stopPropagation();
}

function TripRow({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const { trip, status } = row;
  const { request } = trip;
  const passenger = trip.passengerName || '(no name)';
  const details = [
    request.vehicleType ? VEHICLE_TYPE_LABELS[request.vehicleType] : null,
    request.distanceKm !== null ? `${request.distanceKm.toFixed(1)} km` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const statusTitle =
    (status === 'searching' || status === 'awaiting_passenger') && request.expiresAt
      ? `Expires ${formatDateTime(request.expiresAt)}`
      : TRIP_STATUS_LABELS[status];

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <tr
      className="clickable-row"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      aria-label={`Open the trip requested ${formatDateTime(request.createdAt)} by ${passenger}`}
    >
      <td>
        <div>{formatDate(request.createdAt)}</div>
        <div className="muted small">{formatTime(request.createdAt)}</div>
      </td>
      <td>
        <div className="driver-cell">
          <Avatar name={trip.passengerName} imageUrl={null} size={28} />
          {request.passengerId ? (
            <Link className="list-name truncate" to={`/passengers/${request.passengerId}`} title={passenger} onClick={stop}>
              {passenger}
            </Link>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
      </td>
      <td>
        <div className="route-mini cell-text">
          <div className="route-mini-line">
            <span className="route-dot" aria-hidden="true" />
            <span className="visually-hidden">From </span>
            <span className="truncate" title={request.pickupAddress}>
              {request.pickupAddress || '—'}
            </span>
          </div>
          <div className="route-mini-line">
            <svg className="route-pin" viewBox="0 0 12 16" width="10" height="13" aria-hidden="true">
              <path d="M6 0a6 6 0 0 0-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 0 0-6-6zm0 8.2A2.2 2.2 0 1 1 6 3.8a2.2 2.2 0 0 1 0 4.4z" />
            </svg>
            <span className="visually-hidden">To </span>
            <span className="truncate" title={request.destinationAddress}>
              {request.destinationAddress || '—'}
            </span>
          </div>
          {details && <div className="muted small truncate route-mini-details">{details}</div>}
        </div>
      </td>
      <td className="num">{formatPeso(request.fare)}</td>
      <td>
        {trip.driverName === null || !request.driverId ? (
          <span className="muted small">No driver yet</span>
        ) : (
          <Link
            className="list-name truncate"
            to={`/drivers/all/${request.driverId}`}
            title={trip.driverName || '(no name)'}
            onClick={stop}
          >
            {trip.driverName || '(no name)'}
          </Link>
        )}
      </td>
      <td>
        <span className={`trip-pill trip-pill-${status}`} title={statusTitle}>
          {TRIP_STATUS_LABELS[status]}
        </span>
      </td>
      <td className="cell-chevron" aria-hidden="true">
        ›
      </td>
    </tr>
  );
}
