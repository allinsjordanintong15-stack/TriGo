import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { VEHICLE_TYPE_LABELS } from '../bookings/bookings';
import { Avatar } from '../components/Avatar';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { PhoneNumber } from '../components/PhoneNumber';
import { CopyButton } from '../components/TechnicalDetails';
import { DriverActionDialog, type DriverAction } from '../drivers/DriverActionDialog';
import { DriverActionsMenu } from '../drivers/DriverActionsMenu';
import { averageRating } from '../drivers/driverRatings';
import { matchesDriverSearch, verificationStatus } from '../drivers/driverRecords';
import {
  ACCOUNT_FILTER_OPTIONS,
  ACCOUNT_STANDING_LABELS,
  accountStanding,
  COMMISSION_FILTER_OPTIONS,
  DEFAULT_DRIVER_FILTERS,
  driverTableParams,
  DRIVERS_PAGE_SIZE,
  DUTY_DOT_LABELS,
  DUTY_FILTER_OPTIONS,
  dutyDot,
  hasActiveFilters,
  isAdminSuspended,
  matchesDutyFilter,
  pageSlice,
  readDriverFilters,
  readDriverPage,
  VEHICLE_FILTER_OPTIONS,
  vehicleDescription,
  type AccountStanding,
  type DriverTableFilters,
} from '../drivers/driverTable';
import { loadDriverRowExtras, loadDrivers, type DriverListEntry, type DriverRowExtras } from '../drivers/drivers';
import { COMMISSION_STATUS_LABELS, commissionStatus, type CommissionStatus } from '../earnings/commissionStatus';
import { formatCentavos, formatCount, formatDate, formatDateTime, plural } from '../lib/format';
import { listLoadErrorMessage } from '../lib/loadError';

const ACCOUNT_BADGE_CLASS: Record<AccountStanding, string> = {
  active: 'status-approved',
  suspended: 'status-pending',
  revoked: 'status-rejected',
};

const COLUMN_COUNT = 9;

/** failed: the rating read failed, so the row shows "—" instead of loading forever. */
type RowExtras = DriverRowExtras & { failed?: boolean };

type Row = DriverListEntry & {
  standing: AccountStanding;
  suspended: boolean;
  /** null when the commission account exists but can't be read. */
  commission: { status: CommissionStatus; balanceCentavos: number } | null;
};

function toRow(entry: DriverListEntry, nowMillis: number): Row {
  const { driver, account } = entry;
  const suspended = isAdminSuspended(driver, nowMillis);
  const commission =
    account === null
      ? null
      : account === undefined
        ? { status: 'paid_up' as const, balanceCentavos: 0 }
        : commissionStatus(account, nowMillis);
  return { ...entry, standing: accountStanding(driver.isVerified, suspended), suspended, commission };
}

function matchesFilters(row: Row, filters: DriverTableFilters): boolean {
  if (filters.account !== 'all' && row.standing !== filters.account) return false;
  if (filters.vehicle !== 'all' && row.driver.vehicleType !== filters.vehicle) return false;
  if (!matchesDutyFilter(row.driver, filters.duty)) return false;
  if (filters.commission !== 'all' && row.commission?.status !== filters.commission) return false;
  return matchesDriverSearch(row.driver, row.contact, filters.search);
}

/** /drivers/all: every approved driver, filtered and paged in the browser. */
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

  const rows = useMemo(() => (loaded ? loaded.entries.map((entry) => toRow(entry, loaded.at)) : []), [loaded]);
  const filtered = useMemo(() => rows.filter((row) => matchesFilters(row, filters)), [rows, filters]);
  const slice = pageSlice(filtered, requestedPage);

  // Rating and complaint count only for the rows on screen, once per driver per page load.
  const visibleUids = slice.items.map((row) => row.driver.uid);
  const missingKey = visibleUids.filter((uid) => !extras.has(uid)).join(',');
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    loadDriverRowExtras(missingKey.split(','))
      .then((loadedExtras) => {
        if (!cancelled) setExtras((previous) => new Map([...previous, ...loadedExtras]));
      })
      .catch((error: unknown) => {
        console.error('Driver ratings failed to load:', error);
        if (cancelled) return;
        // Show "—" instead of a spinner forever; Refresh tries again.
        setExtras((previous) => {
          const next = new Map(previous);
          for (const uid of missingKey.split(',')) next.set(uid, { ratingSummary: null, complaintCount: null, failed: true });
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

  function setFilter<K extends keyof DriverTableFilters>(key: K, value: DriverTableFilters[K]) {
    // Typing in the search box replaces the history entry instead of adding one per key.
    update({ ...filters, [key]: value }, 1, key === 'search');
  }

  const filtersSet = hasActiveFilters(filters);
  const clearFilters = () => update(DEFAULT_DRIVER_FILTERS, 1);

  return (
    <div className="stack">
      <PageHeader
        title="Drivers"
        subtitle="Every approved driver. Open one to see their trips, complaints and warnings, or to revoke or restore their verification."
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

      <div className="card drivers-card">
        <div className="drivers-filter-bar">
          <label className="field drivers-search" htmlFor="driver-search">
            <span>Search</span>
            <input
              id="driver-search"
              type="search"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="Name, plate, email or mobile"
              autoComplete="off"
            />
          </label>
          <FilterSelect
            id="driver-status"
            label="Status"
            value={filters.duty}
            options={DUTY_FILTER_OPTIONS}
            onChange={(value) => setFilter('duty', value)}
          />
          <FilterSelect
            id="driver-vehicle"
            label="Vehicle"
            value={filters.vehicle}
            options={VEHICLE_FILTER_OPTIONS}
            onChange={(value) => setFilter('vehicle', value)}
          />
          <FilterSelect
            id="driver-account"
            label="Account"
            value={filters.account}
            options={ACCOUNT_FILTER_OPTIONS}
            onChange={(value) => setFilter('account', value)}
          />
          <FilterSelect
            id="driver-commission"
            label="Commission"
            value={filters.commission}
            options={COMMISSION_FILTER_OPTIONS}
            onChange={(value) => setFilter('commission', value)}
          />
        </div>

        <div className="drivers-result-line" aria-live="polite">
          <span className="muted small">
            {loaded ? plural(filtered.length, 'driver') : loadError ? '' : 'Loading drivers…'}
          </span>
          {filtersSet && (
            <button type="button" className="link-button small" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        {loadError ? (
          <div className="drivers-error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="btn-outline" onClick={() => void reload()}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="table-scroll drivers-table-scroll">
              <table className="data-table drivers-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="visually-hidden">Photo</span>
                    </th>
                    <th scope="col">Driver</th>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">
                      Commission
                    </th>
                    <th scope="col" className="num">
                      Rating
                    </th>
                    <th scope="col" className="num">
                      Complaints
                    </th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!loaded ? (
                    <SkeletonRows />
                  ) : slice.items.length === 0 ? (
                    <tr className="drivers-empty-row">
                      <td colSpan={COLUMN_COUNT}>
                        <div className="empty-state">
                          {rows.length === 0 ? (
                            'No drivers yet. Approved applications appear here.'
                          ) : (
                            <>
                              No drivers match these filters.{' '}
                              <button type="button" className="link-button" onClick={clearFilters}>
                                Clear filters
                              </button>
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
              <div className="drivers-pager">
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
            // A warning changes nothing in the table; everything else does.
            if (pendingAction.action !== 'warning') void reload();
          }}
        />
      )}
    </div>
  );
}

function FilterSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="field drivers-filter" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: DRIVERS_PAGE_SIZE }, (_, index) => (
        <tr key={index} className="drivers-skeleton-row" aria-hidden="true">
          <td>
            <span className="avatar avatar-skeleton" />
          </td>
          {Array.from({ length: COLUMN_COUNT - 1 }, (__, cell) => (
            <td key={cell}>
              <div className="skeleton-line" />
            </td>
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
  const { driver, contact, standing, commission } = row;
  const name = driver.fullName || '(no name)';
  const detailPath = `/drivers/all/${encodeURIComponent(driver.uid)}`;
  const description = vehicleDescription(driver.vehicleColor, driver.vehicleBrand, driver.vehicleModel);
  const dot = dutyDot(driver);
  // A driver whose verification was never set (not revoked by an admin) reads "Not verified".
  const standingLabel =
    standing === 'revoked' && verificationStatus(driver) === 'unverified' ? 'Not verified' : ACCOUNT_STANDING_LABELS[standing];
  const average = averageRating(extras?.ratingSummary ?? null);

  return (
    <tr>
      <td className="drivers-photo">
        <Avatar name={driver.fullName} imageUrl={row.profileImage} />
      </td>
      <td>
        <Link className="drivers-name" to={detailPath}>
          {name}
        </Link>
        {row.joinedAt && <div className="muted small">Joined {formatDate(row.joinedAt)}</div>}
      </td>
      <td>
        <div className="drivers-vehicle-line">
          {driver.vehicleType ? (
            <span className="vehicle-type-tag">{VEHICLE_TYPE_LABELS[driver.vehicleType]}</span>
          ) : (
            <span className="status-badge status-rejected">Invalid type</span>
          )}
          <span className="cell-strong mono">{driver.vehiclePlate || '—'}</span>
        </div>
        {description && <div className="muted small">{description}</div>}
      </td>
      <td>
        {contact?.mobileNumber ? <PhoneNumber phone={contact.mobileNumber} /> : <span className="muted">—</span>}
        {contact?.email && (
          <div className="muted small drivers-email">
            <span>{contact.email}</span> <CopyButton text={contact.email} label="email" />
          </div>
        )}
      </td>
      <td>
        <span
          className={`status-badge ${ACCOUNT_BADGE_CLASS[standing]}`}
          title={
            standing === 'suspended'
              ? `Suspended ${driver.suspendedUntil ? `until ${formatDateTime(driver.suspendedUntil)}` : 'until lifted'}`
              : undefined
          }
        >
          {standingLabel}
        </span>
        <div className="duty-dot-line small">
          <span className={`duty-dot duty-dot-${dot}`} aria-hidden="true" />
          {DUTY_DOT_LABELS[dot]}
        </div>
      </td>
      <td className="num">
        {commission ? (
          <span className={`commission-pill commission-pill-${commission.status}`}>
            {formatCentavos(commission.balanceCentavos)} · {COMMISSION_STATUS_LABELS[commission.status]}
          </span>
        ) : (
          <span className="muted" title="This driver's commission record could not be read.">
            —
          </span>
        )}
      </td>
      <td className="num">
        {!extras ? (
          <span className="skeleton-line skeleton-inline" aria-label="Loading rating" />
        ) : extras.failed ? (
          <span className="muted">—</span>
        ) : average === null ? (
          <span className="muted">New</span>
        ) : (
          <span title={plural(extras.ratingSummary?.ratingCount ?? 0, 'rating')}>
            <span className="rating-star" aria-hidden="true">
              ★
            </span>{' '}
            {average.toFixed(1)} <span className="muted">({formatCount(extras.ratingSummary?.ratingCount ?? 0)})</span>
          </span>
        )}
      </td>
      <td className="num">
        {!extras ? (
          <span className="skeleton-line skeleton-inline" aria-label="Loading complaints" />
        ) : extras.complaintCount === null ? (
          <span className="muted">—</span>
        ) : extras.complaintCount === 0 ? (
          <span className="muted">0</span>
        ) : (
          <Link to={detailPath} title="Complaints from passengers about this driver">
            {formatCount(extras.complaintCount)}
          </Link>
        )}
      </td>
      <td className="cell-action">
        <DriverActionsMenu
          name={name}
          detailPath={detailPath}
          isVerified={driver.isVerified}
          suspended={row.suspended}
          onAction={onAction}
        />
      </td>
    </tr>
  );
}
