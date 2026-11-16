import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { BOOKING_TYPE_LABELS, displayFare, PAYMENT_METHOD_LABELS, VEHICLE_TYPE_LABELS } from '../bookings/bookings';
import { BOOKING_QUERY_LIMIT, loadBookings, type BookingListEntry } from '../bookings/bookingList';
import {
  BOOKING_ROW_STATUS_LABELS,
  BOOKING_TYPE_FILTER_OPTIONS,
  bookingChipLabel,
  bookingRowStatus,
  bookingStatusCounts,
  bookingTableParams,
  DEFAULT_BOOKING_FILTERS,
  hasBookingFilters,
  isDriverNoShow,
  matchesBookingSearch,
  readBookingFilters,
  visibleBookingChips,
  type BookingFilters,
  type BookingRowStatus,
  type BookingTypeFilter,
} from '../bookings/bookingsTable';
import { Avatar } from '../components/Avatar';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { pageSlice, readDriverPage } from '../drivers/driverTable';
import { defaultDateRange, parseDateRange } from '../lib/dateRange';
import { formatCount, formatDate, formatDateTime, formatIsoDay, formatPeso, formatTime, plural } from '../lib/format';
import { listLoadErrorMessage } from '../lib/loadError';
import { DEFAULT_RANGE_DAYS } from '../outOfArea/requests';
import { RANGE_PRESETS, TRIP_PAGE_SIZES, type RangePreset, type TripPageSize } from '../outOfArea/tripsTable';

const COLUMN_COUNT = 7;

type Row = BookingListEntry & { status: BookingRowStatus };

/** The from/to days the filters stand for (custom days missing → the default range). */
function rangeFor(filters: BookingFilters, now: Date): { from: string; to: string } {
  const preset = RANGE_PRESETS.find((p) => p.value === filters.preset);
  if (preset?.days) return defaultDateRange(now, preset.days);
  const fallback = defaultDateRange(now, DEFAULT_RANGE_DAYS);
  return { from: filters.from || fallback.from, to: filters.to || fallback.to };
}

/** /trips/bookings: every booking (standard and out-of-area) created in the date range. */
export function BookingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readBookingFilters(searchParams), [searchParams]);
  const requestedPage = readDriverPage(searchParams);
  const { from, to } = rangeFor(filters, new Date());
  const range = useMemo(() => parseDateRange(from, to), [from, to]);
  const rangeError = 'error' in range ? range.error : null;

  const [loaded, setLoaded] = useState<{ entries: BookingListEntry[]; truncated: boolean; at: Date } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if ('error' in range) return;
    setLoadError(null);
    setLoaded(null);
    try {
      const result = await loadBookings(range);
      setLoaded({ entries: result.entries, truncated: result.truncated, at: new Date() });
    } catch (error) {
      setLoadError(listLoadErrorMessage(error, 'Could not load bookings. Check your connection and try again.'));
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
        ? loaded.entries.map((entry) => ({ ...entry, status: bookingRowStatus(entry.booking, loaded.at.getTime()) }))
        : [],
    [loaded],
  );
  // Chip counts follow the search and type, so each chip says how many rows it would show.
  const narrowed = useMemo(
    () =>
      rows.filter(
        (row) =>
          (filters.type === 'all' || row.booking.bookingType === filters.type) &&
          matchesBookingSearch(row.passengerName, row.driverName, filters.search),
      ),
    [rows, filters.type, filters.search],
  );
  const counts = useMemo(() => bookingStatusCounts(narrowed.map((row) => row.status)), [narrowed]);
  const filtered = filters.status === 'all' ? narrowed : narrowed.filter((row) => row.status === filters.status);
  const slice = pageSlice(filtered, requestedPage, filters.pageSize);

  function update(next: BookingFilters, page: number, replace = false) {
    setSearchParams(bookingTableParams(next, page), { replace });
  }

  function choosePreset(preset: RangePreset) {
    // Custom starts from the range shown now, so the dates are never empty.
    update(preset === 'custom' ? { ...filters, preset, from, to } : { ...filters, preset, from: '', to: '' }, 1);
  }

  const clearFilters = () =>
    update(
      { ...filters, search: '', type: DEFAULT_BOOKING_FILTERS.type, status: DEFAULT_BOOKING_FILTERS.status },
      1,
    );

  return (
    <div className="stack">
      <PageHeader
        title="Bookings"
        subtitle="Every booking, standard and out-of-area. Open one to see its timeline, fare, rating and complaints."
        actions={
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        }
      />

      <div className="card list-card">
        <div className="list-toolbar">
          <div className="segmented" role="group" aria-label="Booked in">
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
              <label className="list-select" htmlFor="bookings-from">
                <span>From</span>
                <input
                  id="bookings-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => update({ ...filters, from: e.target.value, to }, 1, true)}
                />
              </label>
              <label className="list-select" htmlFor="bookings-to">
                <span>To</span>
                <input
                  id="bookings-to"
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
          <label className="list-search" htmlFor="bookings-search">
            <span className="visually-hidden">Search passenger or driver name</span>
            <input
              id="bookings-search"
              type="search"
              value={filters.search}
              onChange={(e) => update({ ...filters, search: e.target.value }, 1, true)}
              placeholder="Search passenger or driver name"
              autoComplete="off"
            />
          </label>
          <label className="list-select" htmlFor="bookings-type">
            <span className="visually-hidden">Type</span>
            <select
              id="bookings-type"
              value={filters.type}
              onChange={(e) => update({ ...filters, type: e.target.value as BookingTypeFilter }, 1)}
            >
              {BOOKING_TYPE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="list-select" htmlFor="bookings-rows">
            <span>Show</span>
            <select
              id="bookings-rows"
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
                ? `${plural(filtered.length, 'booking')} · ${formatIsoDay(from)}${from === to ? '' : ` – ${formatIsoDay(to)}`} · as of ${formatTime(loaded.at)}`
                : loadError
                  ? ''
                  : 'Loading…'}
          </span>
        </div>

        <div className="status-chips" role="group" aria-label="Status">
          {visibleBookingChips(counts, filters.status).map((chip) => (
            <button
              key={chip}
              type="button"
              className={`status-chip${counts[chip] === 0 ? ' is-empty' : ''}`}
              aria-pressed={filters.status === chip}
              onClick={() => update({ ...filters, status: chip }, 1)}
            >
              {bookingChipLabel(chip)} <span className="status-chip-count">{loaded ? formatCount(counts[chip]) : '–'}</span>
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
                Latest {BOOKING_QUERY_LIMIT} bookings shown. Choose a shorter range to see older ones.
              </p>
            )}
            <div className="list-table-scroll">
              <table className="list-table trips-table">
                <colgroup>
                  <col className="col-booked" />
                  <col className="col-b-passenger" />
                  <col className="col-b-driver" />
                  <col className="col-b-route" />
                  <col className="col-b-fare" />
                  <col className="col-b-status" />
                  <col className="col-chevron" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Booked</th>
                    <th scope="col">Passenger</th>
                    <th scope="col">Driver</th>
                    <th scope="col">Route</th>
                    <th scope="col" className="num">
                      Fare
                    </th>
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
                          No bookings in this period.{' '}
                          {hasBookingFilters(filters) && (
                            <button type="button" className="link-button" onClick={clearFilters}>
                              Clear filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    slice.items.map((row) => (
                      <BookingRow
                        key={row.booking.bookingId}
                        row={row}
                        onOpen={() => navigate(`/trips/bookings/${encodeURIComponent(row.booking.bookingId)}`)}
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
                  label="Booking pages"
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

/** Links inside the row handle their own clicks (the row would open the booking). */
function stop(event: MouseEvent) {
  event.stopPropagation();
}

function BookingRow({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const { booking, status } = row;
  const passenger = row.passengerName || '(no name)';
  const details = [
    booking.vehicleType ? VEHICLE_TYPE_LABELS[booking.vehicleType] : null,
    booking.distanceKm !== null ? `${booking.distanceKm.toFixed(1)} km` : null,
    booking.bookingType ? BOOKING_TYPE_LABELS[booking.bookingType] : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const noShow = status === 'cancelled' && isDriverNoShow(booking.cancellationReason);
  const statusTitle =
    status === 'pending' && booking.expiresAt
      ? `Open to drivers until ${formatDateTime(booking.expiresAt)}`
      : status === 'cancelled' && booking.cancelledBy
        ? `Cancelled by the ${booking.cancelledBy}${booking.cancellationReason ? `: ${booking.cancellationReason}` : ''}`
        : BOOKING_ROW_STATUS_LABELS[status];

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
      aria-label={`Open the booking made ${formatDateTime(booking.createdAt)} by ${passenger}`}
    >
      <td className="date-cell">
        <div>{formatDate(booking.createdAt)}</div>
        <div className="muted small">{formatTime(booking.createdAt)}</div>
      </td>
      <td>
        <div className="driver-cell">
          <Avatar name={row.passengerName} imageUrl={null} size={28} />
          {booking.passengerId ? (
            <Link
              className="list-name truncate"
              to={`/passengers/${encodeURIComponent(booking.passengerId)}`}
              title={passenger}
              onClick={stop}
            >
              {passenger}
            </Link>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
      </td>
      <td>
        {row.driverName === null || !booking.driverId ? (
          <span className="muted small">No driver yet</span>
        ) : (
          <Link
            className="list-name truncate"
            to={`/drivers/all/${encodeURIComponent(booking.driverId)}`}
            title={row.driverName || '(no name)'}
            onClick={stop}
          >
            {row.driverName || '(no name)'}
          </Link>
        )}
      </td>
      <td>
        <div className="route-mini cell-text">
          <div className="route-mini-line">
            <span className="route-dot" aria-hidden="true" />
            <span className="visually-hidden">From </span>
            <span className="truncate" title={booking.pickupAddress}>
              {booking.pickupAddress || '—'}
            </span>
          </div>
          <div className="route-mini-line">
            <svg className="route-pin" viewBox="0 0 12 16" width="10" height="13" aria-hidden="true">
              <path d="M6 0a6 6 0 0 0-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 0 0-6-6zm0 8.2A2.2 2.2 0 1 1 6 3.8a2.2 2.2 0 0 1 0 4.4z" />
            </svg>
            <span className="visually-hidden">To </span>
            <span className="truncate" title={booking.destinationAddress}>
              {booking.destinationAddress || '—'}
            </span>
          </div>
          {details && <div className="muted small truncate route-mini-details">{details}</div>}
        </div>
      </td>
      <td className="num">
        <div>{formatPeso(displayFare(booking))}</div>
        {status === 'completed' && booking.paymentMethod && (
          <div className="muted small">{PAYMENT_METHOD_LABELS[booking.paymentMethod]}</div>
        )}
      </td>
      <td>
        <span className={`trip-pill trip-pill-${status}`} title={statusTitle}>
          {BOOKING_ROW_STATUS_LABELS[status]}
        </span>
        {noShow && <div className="muted small no-show-note">Driver no-show</div>}
      </td>
      <td className="cell-chevron" aria-hidden="true">
        ›
      </td>
    </tr>
  );
}
