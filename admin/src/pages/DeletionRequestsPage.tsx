import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime, plural } from '../lib/format';
import {
  DELETION_STATUS_LABELS,
  DELETION_STATUSES,
  loadDeletionRequests,
  type DeletionListEntry,
  type DeletionStatus,
} from '../privacy/deletionRequests';

const ROLE_LABELS: Record<string, string> = { passenger: 'Passenger', driver: 'Driver' };

function parseStatus(value: string | null): DeletionStatus {
  return DELETION_STATUSES.find((status) => status === value) ?? 'pending';
}

export function DeletionRequestsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // The filter lives in the URL (?status=completed) so it survives refresh and the back link.
  const [searchParams, setSearchParams] = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const [entries, setEntries] = useState<DeletionListEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Result message from the detail page (completed / declined), shown once.
  const [message] = useState<string | null>((location.state as { message?: string } | null)?.message ?? null);

  const reload = useCallback(async () => {
    setEntries(null);
    setLoadError(null);
    try {
      setEntries(await loadDeletionRequests(status));
    } catch {
      setLoadError('Could not load deletion requests. Check your connection and reload the page.');
    }
  }, [status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (location.state) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  return (
    <div className="stack">
      <PageHeader
        title="Account deletion"
        subtitle="Requests from Profile → Privacy Policy & Terms in the app, oldest first."
        actions={
          <button type="button" className="btn-outline" onClick={() => void reload()} disabled={!entries && !loadError}>
            Refresh
          </button>
        }
      />
      {message && (
        <div className="alert-success" role="status">
          {message}
        </div>
      )}

      <div className="card">
        <label className="field filter-field" htmlFor="deletion-filter">
          <span>Show</span>
          <select
            id="deletion-filter"
            value={status}
            onChange={(e) => setSearchParams(e.target.value === 'pending' ? {} : { status: e.target.value })}
          >
            {DELETION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DELETION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        {loadError ? (
          <div className="alert-error" role="alert">
            {loadError}
          </div>
        ) : !entries ? (
          <LoadingBlock label="Loading requests…" />
        ) : entries.length === 0 ? (
          <EmptyState>
            {status === 'pending' ? 'No deletion requests waiting.' : `No ${DELETION_STATUS_LABELS[status].toLowerCase()} requests.`}
          </EmptyState>
        ) : (
          <>
            <p className="muted small" aria-live="polite">
              {plural(entries.length, 'request')}
            </p>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Requested</th>
                    <th scope="col">Reason</th>
                    <th scope="col">{status === 'pending' ? 'Sign-in account' : 'Outcome'}</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(({ request, account }) => (
                    <tr key={request.uid}>
                      <td>
                        <div className="cell-strong">{account?.fullName || '(no profile)'}</div>
                        <div className="muted small">
                          {account?.email || <span className="mono">{request.uid}</span>}
                          {account?.role ? ` · ${ROLE_LABELS[account.role] ?? account.role}` : ''}
                        </div>
                      </td>
                      <td>{formatDateTime(request.requestedAt)}</td>
                      <td className="cell-wrap">{request.reason ?? <span className="muted">—</span>}</td>
                      <td>
                        {request.status === 'pending' && 'Not yet'}
                        {request.status === 'completed' &&
                          (request.authDeletedAt ? (
                            `Deleted ${formatDateTime(request.authDeletedAt)}`
                          ) : (
                            <span className="tag tag-warning">Delete in Console</span>
                          ))}
                        {request.status === 'declined' && `Declined ${formatDateTime(request.declinedAt)}`}
                      </td>
                      <td className="cell-action">
                        <Link className="btn-link" to={`/account-deletion/${encodeURIComponent(request.uid)}`}>
                          {request.status === 'pending' ? 'Review' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
