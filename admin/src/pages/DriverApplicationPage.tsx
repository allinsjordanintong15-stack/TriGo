import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  approveApplication,
  formatDateTime,
  loadApplication,
  MAX_REMARKS_LENGTH,
  rejectApplication,
  ReviewConflictError,
  VEHICLE_LABELS,
  VEHICLE_TYPES,
  type ApplicationDocument,
  type DriverApplication,
  type VehicleType,
} from '../drivers/driverApplications';
import { useAdminCounts } from '../lib/adminCounts';

type Decision = 'approve' | 'reject';

const STATUS_LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } as const;

export function DriverApplicationPage() {
  const { uid = '' } = useParams();
  const navigate = useNavigate();
  const { refreshCounts } = useAdminCounts();
  const [application, setApplication] = useState<DriverApplication | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>('tricycle');
  const [approveRemarks, setApproveRemarks] = useState('');
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [rejectTouched, setRejectTouched] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await loadApplication(uid);
      setApplication(result);
      if (result?.vehicleType) setVehicleType(result.vehicleType);
    } catch {
      setLoadError('Could not load this application. Check your connection and reload the page.');
    }
  }, [uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const backLink = (
    <Link to="/drivers" className="back-link">
      ← Back to pending applications
    </Link>
  );

  if (loadError) {
    return (
      <div className="stack">
        {backLink}
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      </div>
    );
  }

  if (application === undefined) {
    return <div className="card muted">Loading application…</div>;
  }

  if (application === null) {
    return (
      <div className="stack">
        {backLink}
        <div className="card">
          <h2>Application not found</h2>
          <p className="muted">There is no driver application for this account.</p>
        </div>
      </div>
    );
  }

  const isPending = application.status === 'pending';
  const approveRemarksTrimmed = approveRemarks.trim();
  const rejectRemarksTrimmed = rejectRemarks.trim();
  const approveRemarksError =
    approveRemarksTrimmed.length > MAX_REMARKS_LENGTH ? `At most ${MAX_REMARKS_LENGTH} characters.` : null;
  const rejectRemarksError = !rejectRemarksTrimmed
    ? 'Remarks are required when rejecting. The applicant sees them.'
    : rejectRemarksTrimmed.length > MAX_REMARKS_LENGTH
      ? `At most ${MAX_REMARKS_LENGTH} characters.`
      : null;

  async function handleConfirm() {
    if (!application || !decision) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (decision === 'approve') {
        await approveApplication(application, vehicleType, approveRemarks);
        refreshCounts();
        navigate('/drivers', { state: { message: `${application.fullName} was approved as a driver.` } });
      } else {
        await rejectApplication(application, rejectRemarks);
        refreshCounts();
        navigate('/drivers', { state: { message: `${application.fullName}'s application was rejected.` } });
      }
    } catch (error) {
      const denied = (error as { code?: string }).code === 'permission-denied';
      setSaveError(
        error instanceof ReviewConflictError
          ? error.message
          : denied
            ? decision === 'approve'
              ? 'Approval was refused. This account may already have a driver record; check it in the Firebase console.'
              : 'The rejection was refused. Reload the application and try again.'
            : 'Could not save the decision. Check your connection and try again.',
      );
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      {backLink}

      <div className="card">
        <div className="card-header">
          <h2>{application.fullName || '(no name)'}</h2>
          <span className={`status-badge status-${application.status}`}>{STATUS_LABELS[application.status]}</span>
        </div>
        <dl className="detail-grid">
          <Detail label="First name" value={application.firstName} />
          <Detail label="Middle name" value={application.middleName ?? '—'} />
          <Detail label="Last name" value={application.lastName} />
          <Detail label="Email" value={application.email} />
          <Detail label="Mobile number" value={application.mobileNumber} />
          <Detail
            label="Vehicle type"
            value={application.vehicleType ? VEHICLE_LABELS[application.vehicleType] : 'Not set'}
          />
          <Detail label="Plate number" value={application.vehiclePlate} mono />
          <Detail label="Submitted" value={formatDateTime(application.submittedAt)} />
          {application.reviewedAt && <Detail label="Last reviewed" value={formatDateTime(application.reviewedAt)} />}
        </dl>
        {application.adminRemarks && (
          <div className="remarks-box">
            <div className="remarks-label">
              {isPending ? 'Remarks from the earlier rejection (resubmitted since)' : 'Admin remarks'}
            </div>
            <p>{application.adminRemarks}</p>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Documents</h3>
        <div className="alert-warning" role="note">
          Document images are unavailable until Firebase Storage is enabled.
        </div>
        <ul className="document-list">
          <DocumentRow label="OR/CR" entry={application.documents.orCr} />
          <DocumentRow label="LTO driver's license" entry={application.documents.ltoLicense} />
        </ul>
      </div>

      {isPending ? (
        <div className="review-grid">
          <section className="card review-panel" aria-labelledby="approve-heading">
            <h3 id="approve-heading">Approve</h3>
            <p className="muted small">
              Creates the driver record: verified, offline, rating 0, with the name and plate above.
            </p>
            <label className="field" htmlFor="approve-vehicle">
              <span>Vehicle type</span>
              <select
                id="approve-vehicle"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                disabled={saving}
              >
                {VEHICLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {VEHICLE_LABELS[type]}
                    {type === application.vehicleType ? ' (from application)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="approve-remarks">
              <span>Remarks (optional)</span>
              <textarea
                id="approve-remarks"
                rows={3}
                value={approveRemarks}
                onChange={(e) => setApproveRemarks(e.target.value)}
                aria-invalid={approveRemarksError ? true : undefined}
                disabled={saving}
              />
              <span className="hint">
                {approveRemarksError ? (
                  <span className="field-error">{approveRemarksError}</span>
                ) : (
                  `${approveRemarksTrimmed.length}/${MAX_REMARKS_LENGTH}`
                )}
              </span>
            </label>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setSaveError(null);
                setDecision('approve');
              }}
              disabled={saving || approveRemarksError !== null}
            >
              Approve…
            </button>
          </section>

          <section className="card review-panel" aria-labelledby="reject-heading">
            <h3 id="reject-heading">Reject</h3>
            <p className="muted small">The applicant sees these remarks and can resubmit.</p>
            <label className="field" htmlFor="reject-remarks">
              <span>Remarks (required)</span>
              <textarea
                id="reject-remarks"
                rows={5}
                value={rejectRemarks}
                onChange={(e) => {
                  setRejectRemarks(e.target.value);
                  setRejectTouched(true);
                }}
                aria-invalid={rejectTouched && rejectRemarksError ? true : undefined}
                disabled={saving}
              />
              <span className="hint">
                {rejectTouched && rejectRemarksError ? (
                  <span className="field-error">{rejectRemarksError}</span>
                ) : (
                  `${rejectRemarksTrimmed.length}/${MAX_REMARKS_LENGTH}`
                )}
              </span>
            </label>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                setRejectTouched(true);
                if (rejectRemarksError) return;
                setSaveError(null);
                setDecision('reject');
              }}
              disabled={saving}
            >
              Reject…
            </button>
          </section>
        </div>
      ) : (
        <div className="card">
          <p className="muted">This application was already reviewed. Only pending applications can be approved or rejected.</p>
        </div>
      )}

      {decision === 'approve' && (
        <ConfirmDialog
          title={`Approve ${application.fullName}?`}
          confirmLabel="Approve driver"
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setDecision(null)}
        >
          <p>This creates their driver record. They can go online and accept bookings right away.</p>
          <table className="change-table">
            <tbody>
              <tr>
                <td>Application status</td>
                <td>Pending → Approved</td>
              </tr>
              <tr>
                <td>Name</td>
                <td>{application.fullName}</td>
              </tr>
              <tr>
                <td>Plate</td>
                <td className="mono">{application.vehiclePlate}</td>
              </tr>
              <tr className={vehicleType !== application.vehicleType ? 'changed' : undefined}>
                <td>Vehicle type</td>
                <td>
                  {application.vehicleType && vehicleType !== application.vehicleType
                    ? `${VEHICLE_LABELS[application.vehicleType]} → ${VEHICLE_LABELS[vehicleType]}`
                    : VEHICLE_LABELS[vehicleType]}
                </td>
              </tr>
              <tr>
                <td>Remarks</td>
                <td>{approveRemarksTrimmed || '—'}</td>
              </tr>
            </tbody>
          </table>
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}

      {decision === 'reject' && (
        <ConfirmDialog
          title={`Reject ${application.fullName}?`}
          confirmLabel="Reject application"
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setDecision(null)}
        >
          <p>Application status: Pending → Rejected. The applicant will see:</p>
          <blockquote className="remarks-quote">{rejectRemarksTrimmed}</blockquote>
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value || '—'}</dd>
    </div>
  );
}

function DocumentRow({ label, entry }: { label: string; entry: ApplicationDocument }) {
  return (
    <li>
      <span className="cell-strong">{label}</span>
      <span className="muted small">{entry ? `${entry.fileName} — image unavailable` : 'Not uploaded'}</span>
    </li>
  );
}
