import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { CopyIconButton } from '../components/CopyIconButton';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { pageSlice, readDriverPage } from '../drivers/driverTable';
import { formatCount, formatDate, plural } from '../lib/format';
import { listLoadErrorMessage } from '../lib/loadError';
import {
  DEFAULT_PASSENGER_FILTERS,
  hasPassengerFilters,
  matchesPassengerChip,
  matchesPassengerName,
  PASSENGER_CHIPS,
  PASSENGER_PAGE_SIZES,
  passengerParams,
  readPassengerFilters,
  type PassengerChip,
  type PassengerFilters,
  type PassengerPageSize,
} from '../passengers/passengerTable';
import {
  loadPassengerList,
  loadPassengerRowExtras,
  type PassengerListEntry,
  type PassengerRowExtras,
} from '../passengers/passengers';
import { SendWarningDialog } from '../warnings/SendWarningDialog';

const COLUMN_COUNT = 6;

/** failed: the counts could not be read, so the row shows "—" instead of loading forever. */
type RowExtras = PassengerRowExtras & { failed?: boolean };

/** /passengers: everyone with a passenger account, searched by name, 10/20/50 per page. */
export function PassengersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readPassengerFilters(searchParams), [searchParams]);
  const requestedPage = readDriverPage(searchParams);
  const [entries, setEntries] = useState<PassengerListEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [extras, setExtras] = useState<Map<string, RowExtras>>(new Map());
  const [warning, setWarning] = useState<PassengerListEntry | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    setEntries(null);
    setExtras(new Map());
    try {
      setEntries(await loadPassengerList());
    } catch (error) {
      setLoadError(listLoadErrorMessage(error, 'Could not load passengers. Check your connection and try again.'));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const searched = useMemo(
    () => (entries ?? []).filter((entry) => matchesPassengerName(entry.passenger.fullName, filters.search)),
    [entries, filters.search],
  );
  const counts = useMemo(() => {
    const result: Record<PassengerChip, number> = { all: searched.length, complaints: 0, warned: 0 };
    for (const entry of searched) {
      if (entry.complaints > 0) result.complaints += 1;
      if (entry.activeWarnings > 0) result.warned += 1;
    }
    return result;
  }, [searched]);
  const filtered = searched.filter((entry) => matchesPassengerChip(filters.chip, entry.complaints, entry.activeWarnings));
  const slice = pageSlice(filtered, requestedPage, filters.pageSize);

  // Trip counts and the driver tag only for the rows on screen, once per passenger per load.
  const missingKey = slice.items
    .map((entry) => entry.passenger.uid)
    .filter((uid) => !extras.has(uid))
    .join(',');
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    const uids = missingKey.split(',');
    loadPassengerRowExtras(uids)
      .then((loaded) => {
        if (!cancelled) setExtras((previous) => new Map([...previous, ...loaded]));
      })
      .catch((error: unknown) => {
        console.error('Passenger trip counts failed to load:', error);
        if (cancelled) return;
        setExtras((previous) => {
          const next = new Map(previous);
          for (const uid of uids) next.set(uid, { completedTrips: 0, cancelledTrips: 0, isDriver: false, failed: true });
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  function update(next: PassengerFilters, page: number, replace = false) {
    setSearchParams(passengerParams(next, page), { replace });
  }

  const clearSearch = () => update({ ...filters, search: '', chip: DEFAULT_PASSENGER_FILTERS.chip }, 1);

  return (
    <div className="stack">
      <PageHeader
        title="Passengers"
        subtitle="Everyone who rides with TriGo. Open a passenger to see their bookings, complaints and warnings."
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
          <label className="list-search" htmlFor="passenger-search">
            <span className="visually-hidden">Search passenger name</span>
            <input
              id="passenger-search"
              type="search"
              value={filters.search}
              onChange={(e) => update({ ...filters, search: e.target.value }, 1, true)}
              placeholder="Search passenger name"
              autoComplete="off"
            />
          </label>
          <label className="list-select" htmlFor="passenger-rows">
            <span>Show</span>
            <select
              id="passenger-rows"
              value={filters.pageSize}
              onChange={(e) => update({ ...filters, pageSize: Number(e.target.value) as PassengerPageSize }, 1)}
            >
              {PASSENGER_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span className="list-count muted small" aria-live="polite">
            {entries ? plural(filtered.length, 'passenger') : loadError ? '' : 'Loading…'}
          </span>
        </div>

        <div className="status-chips" role="group" aria-label="Show">
          {PASSENGER_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={`status-chip${entries && counts[chip.value] === 0 ? ' is-empty' : ''}`}
              aria-pressed={filters.chip === chip.value}
              onClick={() => update({ ...filters, chip: chip.value }, 1)}
            >
              {chip.label} <span className="status-chip-count">{entries ? formatCount(counts[chip.value]) : '–'}</span>
            </button>
          ))}
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
              <table className="list-table passengers-table">
                <colgroup>
                  <col className="col-p-passenger" />
                  <col className="col-p-contact" />
                  <col className="col-p-trips" />
                  <col className="col-p-complaints" />
                  <col className="col-p-warnings" />
                  <col className="col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Passenger</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Trips</th>
                    <th scope="col" className="num">
                      Complaints
                    </th>
                    <th scope="col" className="num">
                      Warnings
                    </th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!entries ? (
                    <SkeletonRows count={filters.pageSize} />
                  ) : slice.items.length === 0 ? (
                    <tr className="list-empty-row">
                      <td colSpan={COLUMN_COUNT}>
                        <div className="empty-state">
                          {entries.length === 0 ? (
                            'No passengers yet.'
                          ) : (
                            <>
                              No passengers found.{' '}
                              {hasPassengerFilters(filters) && (
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
                    slice.items.map((entry) => (
                      <PassengerRow
                        key={entry.passenger.uid}
                        entry={entry}
                        extras={extras.get(entry.passenger.uid)}
                        onWarn={() => {
                          setFlash(null);
                          setWarning(entry);
                        }}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {entries && slice.total > 0 && (
              <div className="list-pager">
                <span className="muted small">
                  Showing {formatCount(slice.from)}–{formatCount(slice.to)} of {formatCount(slice.total)}
                </span>
                <Pagination
                  page={slice.page}
                  pageCount={slice.pageCount}
                  onChange={(page) => update(filters, page)}
                  label="Passenger pages"
                />
              </div>
            )}
          </>
        )}
      </div>

      {warning && (
        <SendWarningDialog
          uid={warning.passenger.uid}
          name={warning.passenger.fullName}
          role="passenger"
          onClose={() => setWarning(null)}
          onDone={(message) => {
            setWarning(null);
            setFlash(message);
            // The Warnings count and the "Warned" chip change.
            void reload();
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

function PassengerRow({
  entry,
  extras,
  onWarn,
}: {
  entry: PassengerListEntry;
  extras: RowExtras | undefined;
  onWarn: () => void;
}) {
  const { passenger } = entry;
  const name = passenger.fullName || '(no name)';
  const profilePath = `/passengers/${encodeURIComponent(passenger.uid)}`;

  return (
    <tr>
      <td>
        <div className="driver-cell">
          <Avatar name={passenger.fullName} imageUrl={entry.profileImage} />
          <div className="cell-text">
            <Link className="list-name truncate" to={profilePath} title={name}>
              {name}
            </Link>
            <div className="passenger-sub">
              {passenger.createdAt && <span className="muted small">Joined {formatDate(passenger.createdAt)}</span>}
              {extras?.isDriver && <span className="driver-tag">Also a driver</span>}
            </div>
          </div>
        </div>
      </td>
      <td>
        <div className="cell-text">
          {passenger.mobileNumber ? (
            <div className="contact-line">
              <span className="truncate" title={passenger.mobileNumber}>
                {passenger.mobileNumber}
              </span>
              <CopyIconButton text={passenger.mobileNumber} label="mobile number" />
            </div>
          ) : (
            <div className="muted">—</div>
          )}
          {passenger.email && (
            <div className="contact-line muted small">
              <span className="truncate" title={passenger.email}>
                {passenger.email}
              </span>
              <CopyIconButton text={passenger.email} label="email" />
            </div>
          )}
        </div>
      </td>
      <td>
        {!extras ? (
          <span className="skeleton-line skeleton-inline" aria-label="Loading trips" />
        ) : extras.failed ? (
          <span className="muted">—</span>
        ) : (
          <>
            <div>{formatCount(extras.completedTrips)} completed</div>
            <div className="muted small">{formatCount(extras.cancelledTrips)} cancelled</div>
          </>
        )}
      </td>
      <td className="num">
        <span
          className={entry.complaints > 0 ? 'count-alert' : 'muted'}
          title={entry.complaints > 0 ? 'Complaints from drivers about this passenger' : undefined}
        >
          {formatCount(entry.complaints)}
        </span>
      </td>
      <td className="num">
        <span className={entry.activeWarnings > 0 ? 'count-warn' : 'muted'}>{formatCount(entry.activeWarnings)}</span>
      </td>
      <td className="cell-actions">
        <RowActionsMenu
          name={name}
          items={[
            { label: 'View profile', to: profilePath },
            { label: 'Send warning', onSelect: onWarn },
          ]}
        />
      </td>
    </tr>
  );
}
