import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { DocumentViewer } from '../components/DocumentViewer';
import { LoadingBlock } from '../components/LoadingBlock';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { VehicleDetailsFields } from '../components/VehicleDetailsFields';
import {
  APPLICATION_DOCUMENT_LABELS,
  APPLICATION_DOCUMENT_TYPES,
  approveApplication,
  loadApplication,
  loadApplicationDocumentImages,
  MAX_REMARKS_LENGTH,
  rejectApplication,
  ReviewConflictError,
  VEHICLE_LABELS,
  VEHICLE_TYPES,
  type ApplicationDocumentType,
  type DocumentImage,
  type DriverApplication,
  type VehicleType,
} from '../drivers/driverApplications';
import {
  hasVehicleDetailErrors,
  normalizeVehicleDetails,
  validateVehicleDetails,
  type VehicleDetails,
} from '../drivers/driverRecords';
import { useAdminCounts } from '../lib/adminCounts';
import { formatDateTime } from '../lib/format';

type Decision = 'approve' | 'reject';

const STATUS_LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } as const;

const EMPTY_DETAILS: VehicleDetails = { vehicleBrand: '', vehicleModel: '', vehicleColor: '' };

const DETAIL_LABELS: Record<keyof VehicleDetails, string> = {
  vehicleBrand: 'Brand',
  vehicleModel: 'Model',
  vehicleColor: 'Color',
};

export function DriverApplicationPage() {
  const { uid = '' } = useParams();
  const navigate = useNavigate();
  const { refreshCounts } = useAdminCounts();
  const [application, setApplication] = useState<DriverApplication | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>('tricycle');
  const [vehicleDetails, setVehicleDetails] = useState<VehicleDetails>(EMPTY_DETAILS);
  const [detailsTouched, setDetailsTouched] = useState(false);
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
      // Applications from before these were required start empty; the admin fills them in.
      setVehicleDetails({
        vehicleBrand: result?.vehicleBrand ?? '',
        vehicleModel: result?.vehicleModel ?? '',
        vehicleColor: result?.vehicleColor ?? '',
      });
      setDetailsTouched(false);
    } catch {
      setLoadError('Could not load this application. Check your connection and reload the page.');
    }
  }, [uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const backLink = (
    <Link to="/drivers/applications" className="back-link">
      ← Back to pending applications
    </Link>
  );

  if (loadError) {
    return (
      <div className="stack page-narrow">
        {backLink}
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      </div>
    );
  }

  if (application === undefined) {
    return (
      <div className="card">
        <LoadingBlock label="Loading application…" lines={5} />
      </div>
    );
  }

  if (application === null) {
    return (
      <div className="stack page-narrow">
        {backLink}
        <PageHeader title="Application not found" subtitle="This account has no driver application, or the link is incomplete." />
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
  const detailErrors = validateVehicleDetails(vehicleDetails);
  const newDetails = normalizeVehicleDetails(vehicleDetails);
  const missingDetails = !application.vehicleBrand || !application.vehicleModel || !application.vehicleColor;

  async function handleConfirm() {
    if (!application || !decision) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (decision === 'approve') {
        await approveApplication(application, { vehicleType, ...vehicleDetails }, approveRemarks);
        refreshCounts();
        navigate('/drivers/applications', { state: { message: `${application.fullName} was approved as a driver.` } });
      } else {
        await rejectApplication(application, rejectRemarks);
        refreshCounts();
        navigate('/drivers/applications', { state: { message: `${application.fullName}'s application was rejected.` } });
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
    <div className="stack page-narrow">
      {backLink}

      <PageHeader
        title={application.fullName || '(no name)'}
        subtitle="Driver application. Check their details and documents, then approve them to start driving or reject with a reason they will read."
        actions={<span className={`status-badge status-${application.status}`}>{STATUS_LABELS[application.status]}</span>}
      />

      <div className="card">
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
          <Detail label="Brand" value={application.vehicleBrand ?? 'Not provided'} />
          <Detail label="Model" value={application.vehicleModel ?? 'Not provided'} />
          <Detail label="Color" value={application.vehicleColor ?? 'Not provided'} />
          <Detail label="Submitted" value={formatDateTime(application.submittedAt)} />
          {application.reviewedAt && <Detail label="Last reviewed" value={formatDateTime(application.reviewedAt)} />}
        </dl>
        {application.adminRemarks && (
          <div className="remarks-box">
            <div className="remarks-label">
              {isPending ? 'Earlier rejection remarks (resubmitted)' : 'Admin remarks'}
            </div>
            <p>{application.adminRemarks}</p>
          </div>
        )}
      </div>

      <DocumentsCard application={application} />

      {isPending ? (
        <div className="review-grid">
          <section className="card review-panel" aria-labelledby="approve-heading">
            <h3 id="approve-heading">Approve</h3>
            <p className="muted small">
              Creates a verified driver with the name and plate above. Check the vehicle against the OR/CR;
              passengers see its color, brand and model.
            </p>
            {missingDetails && (
              <Notice>This application was submitted before brand, model and color were required. Enter them below.</Notice>
            )}
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
            <VehicleDetailsFields
              idPrefix="approve"
              value={vehicleDetails}
              onChange={(value) => {
                setVehicleDetails(value);
                setDetailsTouched(true);
              }}
              errors={detailErrors}
              showErrors={detailsTouched}
              disabled={saving}
            />
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
                setDetailsTouched(true);
                if (hasVehicleDetailErrors(detailErrors)) return;
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
          <p>They can go online and accept bookings right away.</p>
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
              {(Object.keys(DETAIL_LABELS) as (keyof VehicleDetails)[]).map((key) => {
                const before = application[key];
                const after = newDetails[key];
                const changed = before !== after;
                return (
                  <tr key={key} className={changed ? 'changed' : undefined}>
                    <td>{DETAIL_LABELS[key]}</td>
                    <td>{changed ? `${before ?? '—'} → ${after}` : after}</td>
                  </tr>
                );
              })}
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
          danger
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

type DocumentImages = Record<ApplicationDocumentType, DocumentImage | null>;

function formatKilobytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/**
 * The applicant's document photos as thumbnails; a click opens the full-size viewer (zoom,
 * rotate). The bytes are read here only (never on the Applications list) and shown through
 * blob: URLs, revoked when the page closes or the application changes.
 */
function DocumentsCard({ application }: { application: DriverApplication }) {
  const hasReferences = APPLICATION_DOCUMENT_TYPES.some((type) => application.documents[type] !== null);
  const referenceKey = APPLICATION_DOCUMENT_TYPES.map(
    (type) => application.documents[type]?.uploadedAt?.getTime() ?? '',
  ).join(',');
  const [images, setImages] = useState<DocumentImages | null>(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<ApplicationDocumentType | null>(null);

  useEffect(() => {
    if (!hasReferences) return;
    let active = true;
    let urls: string[] = [];
    setImages(null);
    setError('');
    loadApplicationDocumentImages(application.uid)
      .then((loaded) => {
        urls = APPLICATION_DOCUMENT_TYPES.flatMap((type) => (loaded[type] ? [loaded[type].url] : []));
        if (active) setImages(loaded);
        else urls.forEach((url) => URL.revokeObjectURL(url));
      })
      .catch(() => {
        if (active) setError('The document photos could not be loaded. Check your connection and reload the page.');
      });
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [application.uid, hasReferences, referenceKey]);

  const viewed = viewing && images?.[viewing];

  return (
    <div className="card">
      <h3>Documents</h3>
      {!hasReferences ? (
        <p className="muted">No documents on file</p>
      ) : error ? (
        <Notice>{error}</Notice>
      ) : (
        <>
          <p className="muted small">Click a photo to open it full size (zoom and rotate).</p>
          <ul className="doc-thumbs">
            {APPLICATION_DOCUMENT_TYPES.map((type) => {
              const label = APPLICATION_DOCUMENT_LABELS[type];
              const image = images?.[type] ?? null;
              return (
                <li key={type}>
                  {!images ? (
                    <div className="doc-thumb doc-thumb-empty" aria-busy="true">
                      Loading…
                    </div>
                  ) : image ? (
                    <button
                      type="button"
                      className="doc-thumb"
                      onClick={() => setViewing(type)}
                      aria-label={`Open ${label} full size`}
                    >
                      <img src={image.url} alt={label} />
                    </button>
                  ) : (
                    <div className="doc-thumb doc-thumb-empty">Not on file</div>
                  )}
                  <span className="cell-strong">{label}</span>
                  {image && (
                    <span className="muted small">
                      {image.width}×{image.height} · {formatKilobytes(image.sizeBytes)}
                      {image.uploadedAt ? ` · ${formatDateTime(image.uploadedAt)}` : ''}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {viewing && viewed && (
        <DocumentViewer
          title={APPLICATION_DOCUMENT_LABELS[viewing]}
          image={viewed}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
