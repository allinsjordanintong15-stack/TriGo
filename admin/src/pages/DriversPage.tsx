import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { VEHICLE_TYPE_LABELS } from '../bookings/bookings';
import { Avatar } from '../components/Avatar';
import { CopyIconButton } from '../components/CopyIconButton';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { DriverActionDialog, type DriverAction } from '../drivers/DriverActionDialog';
import { DriverActionsMenu } from '../drivers/DriverActionsMenu';
import { averageRating } from '../drivers/driverRatings';
import {
  DEFAULT_DRIVER_FILTERS,
  driverTableParams,
  hasActiveFilters,
  isAdminSuspended,
  matchesDriverName,
  PAGE_SIZE_OPTIONS,
  pageSlice,
  ratingLabel,
  ratingStars,
  readDriverFilters,
  readDriverPage,
  VEHICLE_FILTER_OPTIONS,
  vehicleDescription,
  type DriverTableFilters,
  type PageSize,
  type VehicleFilter,
} from '../drivers/driverTable';
import { loadDriverRowExtras, loadDrivers, type DriverListEntry, type DriverRowExtras } from '../drivers/drivers';
import { commissionStatus, type CommissionStatus } from '../earnings/commissionStatus';
import { formatCentavos, formatCount, formatDateTime, plural } from '../lib/format';
import { listLoadErrorMessage } from '../lib/loadError';

const COLUMN_COUNT = 7;

/** Under the balance; same tones as the driver app's commission chip. */
const COMMISSION_LABELS: Record<CommissionStatus, string> = {
  paid_up: 'Paid up',
  due: 'Due',
  overdue: 'Overdue',
  suspended: 'Suspended for non-payment',
};

/** failed: the rating read failed, so the row shows "—" instead of loading forever. */
type RowExtras = DriverRowExtras & { failed?: boolean };

type Row = DriverListEntry & {
  suspended: boolean;
  /** null when the commission account exists but can't be read. */
  commission: { status: CommissionStatus; balanceCentavos: number } | null;
};

function toRow(entry: DriverListEntry, nowMillis: number): Row {
  const { account } = entry;
  const commission =
    account === null
      ? null
      : account === undefined
        ? { status: 'paid_up' as const, balanceCentavos: 0 }
        : commissionStatus(account, nowMillis);
  return { ...entry, suspended: isAdminSuspended(entry.driver, nowMillis), commission };
}

/**
 * /drivers/all: verified drivers (active and suspended), searched by name and filtered by
 * vehicle in the browser. Revoked drivers are not listed; their profile stays reachable from
 * complaints and trip history.
 */
export function DriversPage() {
  const location = useLocation();
  const routeFlash = (location.state as { message?: string } | null)?.message ?? null;
  const [actionFlash, setActionFlash] = useState<string | null>(null);
  const flash = actionFlash ?? routeFlash;
  const [pendingAction, setPendingAction] = useState<{ row: Row; action: DriverAction } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readDriverFilters(searchParams), [searchParams]);
  const requestedPage = readDriverPage(searchParams);

  const [loaded, setLoaded] = useState<{ entries: DriverListEntry[]; at: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [extras, setExtras] = useState<Map<string, RowExtras>>(new Map());

  const reload = useCallback(async () => {
    setLoadError(null);
    setLoaded(null);
    setExtras(new Map());
    try {
      const entries = await loadDrivers();
      setLoaded({ entries, at: Date.now() });
    } catch (error) {
      setLoadError(listLoadErrorMessage(error, 'Could not load drivers. Check your connection and try again.'));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = useMemo(
    () => (loaded ? loaded.entries.filter((e) => e.driver.isVerified).map((e) => toRow(e, loaded.at)) : []),
    [loaded],
  );
  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (filters.vehicle === 'all' || row.driver.vehicleType === filters.vehicle) &&
          matchesDriverName(row.driver.fullName, filters.search),
      ),
    [rows, filters],
  );
  const slice = pageSlice(filtered, requestedPage, filters.pageSize);

  // Ratings only for the rows on screen, once per driver per page load.
  const missingKey = slice.items
    .map((row) => row.driver.uid)
    .filter((uid) => !extras.has(uid))
    .join(',');
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    const uids = missingKey.split(',');
    loadDriverRowExtras(uids)
      .then((loadedExtras) => {
        if (!cancelled) setExtras((previous) => new Map([...previous, ...loadedExtras]));
      })
      .catch((error: unknown) => {
        console.error('Driver ratings failed to load:', error);
        if (cancelled) return;
        // Show "—" instead of a placeholder forever; Refresh tries again.
        setExtras((previous) => {
          const next = new Map(previous);
          for (const uid of uids) next.set(uid, { ratingSummary: null, failed: true });
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  function update(nextFilters: DriverTableFilters, page: number, replace = false) {
    setSearchParams(driverTableParams(nextFilters, page), { replace });
  }

  const filtersSet = hasActiveFilters(filters);
  const clearSearch = () => update({ ...filters, search: '', vehicle: DEFAULT_DRIVER_FILTERS.vehicle }, 1);

  return (
    <div className="stack">
      <PageHeader
        title="Drivers"
        subtitle="Verified drivers. Open one to see their trips, complaints and warnings, or to revoke their verification."
        actions={
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        }
      />
      {flash && (
        <div className="alert-success" role="status">
          {flash}
        </div>
      )}

      <div className="card list-card">
        <div className="list-toolbar">
          <label className="list-search" htmlFor="driver-search">
            <span className="visually-hidden">Search driver name</span>
            <input
              id="driver-search"
              type="search"
              value={filters.search}
              // Typing replaces the history entry instead of adding one per key.
              onChange={(e) => update({ ...filters, search: e.target.value }, 1, true)}
              placeholder="Search driver name"
              autoComplete="off"
            />
          </label>
          <label className="list-select" htmlFor="driver-rows">
            <span>Show</span>
            <select
              id="driver-rows"
              value={filters.pageSize}
              onChange={(e) => update({ ...filters, pageSize: Number(e.target.value) as PageSize }, 1)}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <label className="list-select" htmlFor="driver-vehicle">
            <span className="visually-hidden">Vehicle</span>
            <select
              id="driver-vehicle"
              value={filters.vehicle}
              onChange={(e) => update({ ...filters, vehicle: e.target.value as VehicleFilter }, 1)}
            >
              {VEHICLE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span className="list-count muted small" aria-live="polite">
            {loaded ? plural(filtered.length, 'driver') : loadError ? '' : 'Loading…'}
          </span>
        </div>

        {loadError ? (
          <div className="list-error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="btn-outline" onClick={() => void reload()}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="list-table-scroll">
              <table className="list-table">
                <colgroup>
                  <col className="col-driver" />
                  <col className="col-vehicle" />
                  <col className="col-contact" />
                  <col className="col-status" />
                  <col className="col-commission" />
                  <col className="col-rating" />
                  <col className="col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Driver</th>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">
                      Commission
                    </th>
                    <th scope="col">Rating</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
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
                          {rows.length === 0 ? (
                            'No verified drivers yet. Approved applications appear here.'
                          ) : (
                            <>
                              No drivers found.{' '}
                              {filtersSet && (
                                <button type="button" className="link-button" onClick={clearSearch}>
                                  Clear search
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    slice.items.map((row) => (
                      <DriverRow
                        key={row.driver.uid}
                        row={row}
                        extras={extras.get(row.driver.uid)}
                        onAction={(action) => {
                          setActionFlash(null);
                          setPendingAction({ row, action });
                        }}
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
                  label="Driver pages"
                />
              </div>
            )}
          </>
        )}
      </div>

      {pendingAction && (
        <DriverActionDialog
          driver={pendingAction.row.driver}
          action={pendingAction.action}
          onClose={() => setPendingAction(null)}
          onDone={(message) => {
            setPendingAction(null);
            setActionFlash(message);
            // A warning changes nothing in the table; a suspension or lift does.
            if (pendingAction.action !== 'warning') void reload();
          }}
        />
      )}
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: Math.min(count, 10) }, (_, index) => (
        <tr key={index} className="list-skeleton-row" aria-hidden="true">
          <td>
            <div className="driver-cell">
              <span className="avatar avatar-skeleton" />
              <div className="skeleton-line" />
            </div>
          </td>
          {Array.from({ length: COLUMN_COUNT - 1 }, (__, cell) => (
            <td key={cell}>{cell < COLUMN_COUNT - 2 && <div className="skeleton-line" />}</td>
          ))}
        </tr>
      ))}
    </>
  );
}

function DriverRow({
  row,
  extras,
  onAction,
}: {
  row: Row;
  extras: RowExtras | undefined;
  onAction: (action: DriverAction) => void;
}) {
  const { driver, contact, commission, suspended } = row;
  const name = driver.fullName || '(no name)';
  const detailPath = `/drivers/all/${encodeURIComponent(driver.uid)}`;
  const description = vehicleDescription(driver.vehicleColor, driver.vehicleBrand, driver.vehicleModel);
  const vehicleType = driver.vehicleType ? VEHICLE_TYPE_LABELS[driver.vehicleType] : 'Invalid type';
  const suspendedTitle = suspended
    ? `Suspended ${driver.suspendedUntil ? `until ${formatDateTime(driver.suspendedUntil)}` : 'until lifted'}`
    : undefined;

  return (
    <tr>
      <td>
        <div className="driver-cell">
          <Avatar name={driver.fullName} imageUrl={row.profileImage} />
          <div className="cell-text">
            <Link className="list-name truncate" to={detailPath} title={name}>
              {name}
            </Link>
            {suspended && (
              <span className="suspended-tag" title={suspendedTitle}>
                Suspended
              </span>
            )}
          </div>
        </div>
      </td>
      <td>
        <div className="cell-text">
          <div className="truncate" title={`${vehicleType} · ${driver.vehiclePlate}`}>
            {vehicleType} · <strong>{driver.vehiclePlate || '—'}</strong>
          </div>
          {description && (
            <div className="muted small truncate" title={description}>
              {description}
            </div>
          )}
        </div>
      </td>
      <td>
        <div className="cell-text">
          {contact?.mobileNumber ? (
            <div className="contact-line">
              <span className="truncate" title={contact.mobileNumber}>
                {contact.mobileNumber}
              </span>
              <CopyIconButton text={contact.mobileNumber} label="mobile number" />
            </div>
          ) : (
            <div className="muted">—</div>
          )}
          {contact?.email && (
            <div className="contact-line muted small">
              <span className="truncate" title={contact.email}>
                {contact.email}
              </span>
              <CopyIconButton text={contact.email} label="email" />
            </div>
          )}
        </div>
      </td>
      <td>
        <span className={`online-status ${driver.isOnline ? 'is-online' : 'is-offline'}`}>
          <span className="online-dot" aria-hidden="true" />
          {driver.isOnline ? 'Online' : 'Offline'}
        </span>
      </td>
      <td className="num">
        {commission ? (
          <>
            <div className="commission-amount">{formatCentavos(commission.balanceCentavos)}</div>
            <span
              className={`commission-label commission-label-${commission.status}`}
              title={COMMISSION_LABELS[commission.status]}
            >
              {COMMISSION_LABELS[commission.status]}
            </span>
          </>
        ) : (
          <span className="muted" title="This driver's commission record could not be read.">
            —
          </span>
        )}
      </td>
      <td>
        <RatingCell extras={extras} />
      </td>
      <td className="cell-actions">
        <DriverActionsMenu name={name} suspended={suspended} onAction={onAction} />
      </td>
    </tr>
  );
}

function RatingCell({ extras }: { extras: RowExtras | undefined }) {
  if (!extras) return <span className="skeleton-line skeleton-inline" aria-label="Loading rating" />;
  if (extras.failed) return <span className="muted">—</span>;
  const average = averageRating(extras.ratingSummary);
  const count = extras.ratingSummary?.ratingCount ?? 0;
  if (average === null) return <span className="muted small">No ratings yet</span>;
  const stars = ratingStars(average);
  return (
    <div className="rating-cell" title={ratingLabel(average, count)}>
      <span className="rating-stars" aria-hidden="true">
        {'★'.repeat(stars.full)}
        {stars.half && <span className="star-half">★</span>}
        <span className="star-empty">{'★'.repeat(stars.empty)}</span>
      </span>
      <span className="visually-hidden">{ratingLabel(average, count)}</span>
      <span className="rating-numbers" aria-hidden="true">
        <strong>{average.toFixed(1)}</strong>{' '}
        <span className="muted small">
          ({count} rating{count === 1 ? '' : 's'})
        </span>
      </span>
    </div>
  );
}
