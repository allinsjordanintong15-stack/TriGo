import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';

import { ComplaintDrawer } from '../complaints/ComplaintDrawer';
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_QUERY_LIMIT,
  COMPLAINT_STATUS_LABELS,
  complaintTab,
  loadComplaintCounts,
  loadComplaints,
  loadReportedFallback,
  ROLE_LABELS,
  type ComplaintListEntry,
  type ComplaintStatus,
  type ReportedFallback,
} from '../complaints/complaints';
import {
  COMPLAINT_CHIPS,
  COMPLAINT_PAGE_SIZES,
  complaintParams,
  emptyComplaintsText,
  firstLine,
  matchesComplaintSearch,
  outcomeText,
  readComplaintFilters,
  type ComplaintFilters,
  type ComplaintPageSize,
} from '../complaints/complaintsTable';
import { reportedRoleFor } from '../complaints/reportedParty';
import { Avatar } from '../components/Avatar';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { pageSlice, readDriverPage } from '../drivers/driverTable';
import { formatCount, formatDate, formatTime, plural } from '../lib/format';
import { listLoadErrorMessage } from '../lib/loadError';
import { DELETED_NAME } from '../privacy/deletionPlan';

const COLUMN_COUNT = 5;

/** A loaded profile name; "Unknown user" for a missing profile or a deleted (anonymized) account. */
function displayName(name: string): string {
  return name && name !== DELETED_NAME ? name : 'Unknown user';
}

function profilePath(uid: string, role: 'passenger' | 'driver' | null): string {
  return role === 'driver' ? `/drivers/all/${encodeURIComponent(uid)}` : `/passengers/${encodeURIComponent(uid)}`;
}

/** /complaints/:tab: one tab (who reported) of the Complaints section. */
export function ComplaintsPage() {
  const current = complaintTab(useParams().tab);
  if (!current) return <Navigate to="/complaints" replace />;
  // Keyed by tab so switching tabs starts with a fresh list.
  return <ComplaintsTab key={current.tab} tab={current} />;
}

function ComplaintsTab({ tab }: { tab: NonNullable<ReturnType<typeof complaintTab>> }) {
  const reporterRole = tab.reporterRole;
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readComplaintFilters(searchParams), [searchParams]);
  const requestedPage = readDriverPage(searchParams);
  const [counts, setCounts] = useState<Record<ComplaintStatus, number> | null>(null);
  const [entries, setEntries] = useState<ComplaintListEntry[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fallbacks, setFallbacks] = useState<Map<string, ReportedFallback>>(new Map());

  const status = filters.status === 'all' ? null : filters.status;
  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const [loadedCounts, list] = await Promise.all([loadComplaintCounts(reporterRole), loadComplaints(reporterRole, status)]);
      setCounts(loadedCounts);
      setEntries(list.entries);
      setTruncated(list.truncated);
    } catch (error) {
      setLoadError(listLoadErrorMessage(error, 'Could not load complaints. Check your connection and try again.'));
    }
  }, [reporterRole, status]);

  useEffect(() => {
    setEntries(null);
    void reload();
  }, [reload]);

  const filtered = useMemo(
    () =>
      (entries ?? []).filter((entry) => {
        const fallback = fallbacks.get(entry.complaint.complaintId);
        const reported = entry.reportedName ?? (fallback ? fallback.name : null);
        return matchesComplaintSearch(entry.reporterName, reported, filters.search);
      }),
    [entries, fallbacks, filters.search],
  );
  const slice = pageSlice(filtered, requestedPage, filters.pageSize);

  // Older complaints (no reportedUserId): who they're about, from the booking, visible rows only.
  const missingKey = slice.items
    .filter((entry) => entry.complaint.reportedUserId === undefined && !fallbacks.has(entry.complaint.complaintId))
    .map((entry) => entry.complaint.complaintId)
    .join(',');
  useEffect(() => {
    if (!missingKey || !entries) return;
    let cancelled = false;
    const ids = new Set(missingKey.split(','));
    loadReportedFallback(entries.filter((e) => ids.has(e.complaint.complaintId)).map((e) => e.complaint))
      .then((loaded) => !cancelled && setFallbacks((previous) => new Map([...previous, ...loaded])))
      .catch((error: unknown) => console.error('Reported person lookup failed:', error));
    return () => {
      cancelled = true;
    };
  }, [missingKey, entries]);

  function update(next: ComplaintFilters, page: number, replace = false) {
    setSearchParams(complaintParams(next, page), { replace });
  }

  const total = counts ? counts.open + counts.in_review + counts.resolved : null;
  const chipCount = (value: ComplaintFilters['status']) => (counts ? (value === 'all' ? total : counts[value]) : null);
  const closeDrawer = useCallback(
    () => setSearchParams(complaintParams({ ...readComplaintFilters(searchParams), open: null }, requestedPage)),
    [searchParams, requestedPage, setSearchParams],
  );

  return (
    <>
      <PageHeader
        title={`Complaints ${tab.label.toLowerCase()}`}
        subtitle={`Problems ${ROLE_LABELS[reporterRole].toLowerCase()}s reported from bookings in the app. Reporters see the status, never your notes.`}
        actions={
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        }
      />

      <div className="card list-card">
        <div className="list-toolbar">
          <label className="list-search" htmlFor="complaint-search">
            <span className="visually-hidden">Search reporter or reported person</span>
            <input
              id="complaint-search"
              type="search"
              value={filters.search}
              onChange={(e) => update({ ...filters, search: e.target.value }, 1, true)}
              placeholder="Search reporter or reported person"
              autoComplete="off"
            />
          </label>
          <label className="list-select" htmlFor="complaint-rows">
            <span>Show</span>
            <select
              id="complaint-rows"
              value={filters.pageSize}
              onChange={(e) => update({ ...filters, pageSize: Number(e.target.value) as ComplaintPageSize }, 1)}
            >
              {COMPLAINT_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span className="list-count muted small" aria-live="polite">
            {entries ? plural(filtered.length, 'complaint') : loadError ? '' : 'Loading…'}
          </span>
        </div>

        <div className="status-chips" role="group" aria-label="Status">
          {COMPLAINT_CHIPS.map((chip) => {
            const count = chipCount(chip.value);
            return (
              <button
                key={chip.value}
                type="button"
                className={`status-chip${count === 0 ? ' is-empty' : ''}`}
                aria-pressed={filters.status === chip.value}
                onClick={() => update({ ...filters, status: chip.value }, 1)}
              >
                {chip.label} <span className="status-chip-count">{count === null ? '–' : formatCount(count)}</span>
              </button>
            );
          })}
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
            {truncated && (
              <p className="alert-warning" role="status">
                Showing the latest {COMPLAINT_QUERY_LIMIT} complaints. Choose a status to see older ones.
              </p>
            )}
            <div className="list-table-scroll">
              <table className="list-table complaints-table">
                <colgroup>
                  <col className="col-cp-date" />
                  <col className="col-cp-about" />
                  <col className="col-cp-by" />
                  <col className="col-cp-what" />
                  <col className="col-cp-status" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Reported</th>
                    <th scope="col">About</th>
                    <th scope="col">Reported by</th>
                    <th scope="col">What happened</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!entries ? (
                    Array.from({ length: Math.min(filters.pageSize, 10) }, (_, i) => (
                      <tr key={i} className="list-skeleton-row" aria-hidden="true">
                        {Array.from({ length: COLUMN_COUNT }, (__, c) => (
                          <td key={c}>
                            <div className="skeleton-line" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : slice.items.length === 0 ? (
                    <tr className="list-empty-row">
                      <td colSpan={COLUMN_COUNT}>
                        <div className="empty-state">{emptyComplaintsText(filters.status, filters.search.trim() !== '')}</div>
                      </td>
                    </tr>
                  ) : (
                    slice.items.map((entry) => (
                      <ComplaintRow
                        key={entry.complaint.complaintId}
                        entry={entry}
                        fallback={fallbacks.get(entry.complaint.complaintId)}
                        onOpen={() => update({ ...filters, open: entry.complaint.complaintId }, slice.page)}
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
                  label="Complaint pages"
                />
              </div>
            )}
          </>
        )}
      </div>

      {filters.open && (
        <ComplaintDrawer complaintId={filters.open} onClose={closeDrawer} onListChanged={() => void reload()} />
      )}
    </>
  );
}

function ComplaintRow({
  entry,
  fallback,
  onOpen,
}: {
  entry: ComplaintListEntry;
  fallback: ReportedFallback | undefined;
  onOpen: () => void;
}) {
  const { complaint } = entry;
  const role = reportedRoleFor(complaint.reporterRole);
  // Stored reported person, else (older complaints) the booking's other side.
  const reported =
    typeof complaint.reportedUserId === 'string'
      ? { uid: complaint.reportedUserId, name: entry.reportedName ?? '' }
      : complaint.reportedUserId === undefined
        ? (fallback ?? null)
        : null;
  const loadingFallback = complaint.reportedUserId === undefined && fallback === undefined;
  const category = complaint.category ? COMPLAINT_CATEGORY_LABELS[complaint.category] : 'Complaint';
  const line = firstLine(complaint.message);
  const outcome = complaint.status === 'resolved' ? outcomeText(complaint.outcome) : null;

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <tr className="clickable-row" tabIndex={0} onClick={onOpen} onKeyDown={onKeyDown} aria-label={`Open the complaint: ${category}`}>
      <td className="date-cell">
        <div>{formatDate(complaint.createdAt)}</div>
        <div className="muted small">{formatTime(complaint.createdAt)}</div>
      </td>
      <td>
        {loadingFallback ? (
          <span className="skeleton-line skeleton-inline" aria-label="Loading" />
        ) : reported ? (
          <div className="driver-cell">
            <Avatar name={reported.name} imageUrl={null} size={28} />
            <div className="cell-text">
              <Link
                className="list-name truncate"
                to={profilePath(reported.uid, role)}
                title={displayName(reported.name)}
                onClick={(e) => e.stopPropagation()}
              >
                {displayName(reported.name)}
              </Link>
              {role && <span className="muted small">{ROLE_LABELS[role]}</span>}
            </div>
          </div>
        ) : (
          <span className="muted small">No driver assigned</span>
        )}
      </td>
      <td>
        {complaint.reporterId ? (
          <Link
            className="list-name truncate"
            to={profilePath(complaint.reporterId, complaint.reporterRole)}
            title={displayName(entry.reporterName)}
            onClick={(e) => e.stopPropagation()}
          >
            {displayName(entry.reporterName)}
          </Link>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        <div className="cell-text">
          <span className="cell-strong truncate">{category}</span>
          <span className="muted small truncate" title={complaint.message}>
            {line || '—'}
          </span>
        </div>
      </td>
      <td>
        <span className={`complaint-pill complaint-pill-${complaint.status}`}>{COMPLAINT_STATUS_LABELS[complaint.status]}</span>
        {outcome && <div className="muted small">{outcome}</div>}
      </td>
    </tr>
  );
}
