import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { formatDateTime } from '../bookings/bookings';
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
      <div className="card">
        <div className="card-header">
          <h2>Complaints</h2>
          <button type="button" className="btn-outline" onClick={() => void reload()} disabled={!entries && !loadError}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Problems reported by passengers and drivers from a booking in the app ("Report a problem"). Each person can
          report a booking once. Set the status and keep notes here; reporters see the status but never the notes.
        </p>
      </div>

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
                <div className="stat-value">{counts ? counts[s].toLocaleString() : '…'}</div>
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
              <p className="muted">Loading complaints…</p>
            ) : (
              <>
                <p className="muted small" aria-live="polite">
                  {entries.length === 1 ? '1 complaint' : `${entries.length} complaints`}, newest first.
                </p>
                {truncated && (
                  <p className="alert-warning" role="status">
                    Showing the latest {COMPLAINT_QUERY_LIMIT} complaints. Filter by status to see older ones.
                  </p>
                )}
                {entries.length === 0 ? (
                  <p className="muted">{status ? 'No complaints with this status.' : 'No complaints yet.'}</p>
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
