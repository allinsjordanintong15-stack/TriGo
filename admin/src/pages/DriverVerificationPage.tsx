import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { loadPendingApplications, VEHICLE_LABELS, type DriverApplication } from '../drivers/driverApplications';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime } from '../lib/format';

export function DriverVerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<DriverApplication[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Result message from the detail page (approve / reject), shown once.
  const [message] = useState<string | null>((location.state as { message?: string } | null)?.message ?? null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setApplications(await loadPendingApplications());
    } catch {
      setLoadError('Could not load driver applications. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Drop the message from history so a refresh does not show it again.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  return (
    <div className="stack">
      <PageHeader
        title="Driver verification"
        subtitle="Pending applications, oldest first. Approving lets the applicant work as a driver."
        actions={
          <button type="button" className="btn-outline" onClick={() => void reload()}>
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
        {loadError ? (
          <div className="alert-error" role="alert">
            {loadError}
          </div>
        ) : !applications ? (
          <LoadingBlock label="Loading applications…" />
        ) : applications.length === 0 ? (
          <EmptyState>No applications waiting for review.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Applicant</th>
                  <th scope="col">Vehicle</th>
                  <th scope="col">Plate</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.uid}>
                    <td>
                      <div className="cell-strong">{application.fullName || '(no name)'}</div>
                      <div className="muted small">{application.email}</div>
                      {application.adminRemarks && <span className="tag">Resubmitted</span>}
                    </td>
                    <td>{application.vehicleType ? VEHICLE_LABELS[application.vehicleType] : '—'}</td>
                    <td className="mono">{application.vehiclePlate}</td>
                    <td>{formatDateTime(application.submittedAt)}</td>
                    <td className="cell-action">
                      <Link className="btn-link" to={`/drivers/${application.uid}`}>
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
