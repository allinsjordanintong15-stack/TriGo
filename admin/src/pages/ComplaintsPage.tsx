import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_QUERY_LIMIT,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUSES,
  loadComplaintCounts,
  loadComplaints,
  ROLE_LABELS,
  type ComplaintListEntry,
  type ComplaintStatus,
} from '../complaints/complaints';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { formatCount, formatDateTime, plural } from '../lib/format';

function parseStatus(value: string | null): ComplaintStatus | null {
  return COMPLAINT_STATUSES.find((status) => status === value) ?? null;
}

export function ComplaintsPage() {
  // The filter lives in the URL (?status=open) so it survives refresh and the detail page's back link.
  const [searchParams, setSearchParams] = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const [counts, setCounts] = useState<Record<ComplaintStatus, number> | null>(null);
  const [entries, setEntries] = useState<ComplaintListEntry[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    setEntries(null);
    try {
      const [loadedCounts, list] = await Promise.all([loadComplaintCounts(), loadComplaints(status)]);
      setCounts(loadedCounts);
      setEntries(list.entries);
      setTruncated(list.truncated);
    } catch {
      setLoadError('Could not load complaints. Check your connection and reload the page.');
    }
  }, [status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function changeFilter(value: string) {
    const next = parseStatus(value);
    setSearchParams(next ? { status: next } : {});
  }

  const total = counts ? counts.open + counts.in_review + counts.resolved : null;
  const detailSearch = status ? `?from=${status}` : '';

  return (
    <>
      <PageHeader
        title="Complaints"
        subtitle="Problems reported from bookings in the app. Reporters see the status, never your notes."
        actions={
          <button type="button" className="btn-outline" onClick={() => void reload()} disabled={!entries && !loadError}>
            Refresh
          </button>
        }
      />

      {loadError ? (
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      ) : (
        <>
          <div className="stat-grid">
            {COMPLAINT_STATUSES.map((s) => (
              <div key={s} className="card stat-card">
                <div className="stat-label">{COMPLAINT_STATUS_LABELS[s]}</div>
                <div className="stat-value">{counts ? formatCount(counts[s]) : '…'}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <label className="field filter-field" htmlFor="complaint-filter">
              <span>Show</span>
              <select id="complaint-filter" value={status ?? 'all'} onChange={(e) => changeFilter(e.target.value)}>
                <option value="all">All complaints{total !== null ? ` (${total})` : ''}</option>
                {COMPLAINT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {COMPLAINT_STATUS_LABELS[s]}
                    {counts ? ` (${counts[s]})` : ''}
                  </option>
                ))}
              </select>
            </label>

            {!entries ? (
              <LoadingBlock label="Loading complaints…" />
            ) : (
              <>
                <p className="muted small" aria-live="polite">
                  {plural(entries.length, 'complaint')}, newest first.
                </p>
                {truncated && (
                  <p className="alert-warning" role="status">
                    Showing the latest {COMPLAINT_QUERY_LIMIT} complaints. Filter by status to see older ones.
                  </p>
                )}
                {entries.length === 0 ? (
                  <EmptyState>{status ? 'No complaints with this status.' : 'No complaints yet.'}</EmptyState>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table complaints-table">
                      <thead>
                        <tr>
                          <th scope="col">Reported</th>
                          <th scope="col">Booking</th>
                          <th scope="col">Reported by</th>
                          <th scope="col">Category</th>
                          <th scope="col">Status</th>
                          <th scope="col">
                            <span className="visually-hidden">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map(({ complaint, reporterName }) => (
                          <tr key={complaint.complaintId}>
                            <td>{formatDateTime(complaint.createdAt)}</td>
                            <td className="mono">{complaint.bookingId || '—'}</td>
                            <td>
                              <div>{reporterName || '(no name)'}</div>
                              <div className="muted small">
                                {complaint.reporterRole ? ROLE_LABELS[complaint.reporterRole] : 'Unknown role'}
                              </div>
                            </td>
                            <td>{complaint.category ? COMPLAINT_CATEGORY_LABELS[complaint.category] : '—'}</td>
                            <td>
                              <span className={`booking-status complaint-status-${complaint.status}`}>
                                {COMPLAINT_STATUS_LABELS[complaint.status]}
                              </span>
                            </td>
                            <td className="cell-action">
                              <Link
                                className="btn-link"
                                to={`/reports/complaints/${encodeURIComponent(complaint.complaintId)}${detailSearch}`}
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
