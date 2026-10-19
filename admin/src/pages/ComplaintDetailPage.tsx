import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import {
  BOOKING_STATUS_LABELS,
  BOOKING_TYPE_LABELS,
  displayFare,
  formatDateTime,
  formatPesoOrDash,
  VEHICLE_TYPE_LABELS,
} from '../bookings/bookings';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUSES,
  ComplaintConflictError,
  loadComplaintDetail,
  MAX_ADMIN_NOTES_LENGTH,
  reviewComplaint,
  ROLE_LABELS,
  type ComplaintDetail,
  type ComplaintStatus,
} from '../complaints/complaints';

export function ComplaintDetailPage() {
  const { complaintId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { admin } = useAuth();
  const [detail, setDetail] = useState<ComplaintDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<ComplaintStatus>('open');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const loaded = await loadComplaintDetail(complaintId);
      setDetail(loaded);
      if (loaded) {
        setStatus(loaded.complaint.status);
        setNotes(loaded.complaint.adminNotes);
      }
    } catch {
      setLoadError('Could not load this complaint. Check your connection and reload the page.');
    }
  }, [complaintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Back to the list with the filter it was opened from.
  const fromStatus = COMPLAINT_STATUSES.find((s) => s === searchParams.get('from'));
  const backLink = (
    <Link to={`/reports/complaints${fromStatus ? `?status=${fromStatus}` : ''}`} className="back-link">
      ← Back to complaints
    </Link>
  );

  if (loadError) {
    return (
      <>
        {backLink}
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      </>
    );
  }

  if (detail === undefined) {
    return <div className="card muted">Loading complaint…</div>;
  }

  if (detail === null) {
    return (
      <>
        {backLink}
        <div className="card">
          <h2>Complaint not found</h2>
          <p className="muted">There is no complaint with this ID.</p>
        </div>
      </>
    );
  }

  const { complaint, booking } = detail;
  const notesTrimmed = notes.trim();
  const notesTooLong = notesTrimmed.length > MAX_ADMIN_NOTES_LENGTH;
  const statusChanged = status !== complaint.status;
  const notesChanged = notesTrimmed !== complaint.adminNotes;

  async function handleConfirm() {
    if (!admin) return;
    setSaving(true);
    setSaveError(null);
    try {
      await reviewComplaint(
        complaint.complaintId,
        admin.uid,
        { status: complaint.status, adminNotes: complaint.adminNotes },
        { status, adminNotes: notesTrimmed },
      );
      setMessage(statusChanged ? `Status changed to ${COMPLAINT_STATUS_LABELS[status]}.` : 'Notes saved.');
      setConfirming(false);
      setSaving(false);
      await reload();
    } catch (error) {
      const denied = (error as { code?: string }).code === 'permission-denied';
      setSaveError(
        error instanceof ComplaintConflictError
          ? error.message
          : denied
            ? 'The change was refused. Reload the page and try again.'
            : 'Could not save the change. Check your connection and try again.',
      );
      setSaving(false);
    }
  }

  return (
    <>
      {backLink}

      <div className="card">
        <div className="card-header">
          <h2>Complaint</h2>
          <button type="button" className="btn-outline" onClick={() => void reload()} disabled={saving}>
            Refresh
          </button>
        </div>
        <p className="muted small mono">{complaint.complaintId}</p>
        <p>
          <span className={`booking-status complaint-status-${complaint.status}`}>
            {COMPLAINT_STATUS_LABELS[complaint.status]}
          </span>
        </p>
        <dl className="detail-grid">
          <Detail label="Reported" value={formatDateTime(complaint.createdAt)} />
          <Detail
            label="Reported by"
            value={`${detail.reporterName || '(no name)'} · ${complaint.reporterRole ? ROLE_LABELS[complaint.reporterRole] : 'Unknown role'}`}
          />
          <Detail label="Category" value={complaint.category ? COMPLAINT_CATEGORY_LABELS[complaint.category] : ''} />
        </dl>
        <h3 className="complaint-message-title">Message</h3>
        <blockquote className="remarks-quote complaint-message">{complaint.message || '—'}</blockquote>
      </div>

      <div className="card">
        <h3>Booking</h3>
        {booking ? (
          <>
            <dl className="detail-grid">
              <Detail label="Booking ID" value={booking.bookingId} mono />
              <Detail label="Status" value={booking.status ? BOOKING_STATUS_LABELS[booking.status] : 'Unknown'} />
              <Detail
                label="Type"
                value={[
                  booking.bookingType ? BOOKING_TYPE_LABELS[booking.bookingType] : null,
                  booking.vehicleType ? VEHICLE_TYPE_LABELS[booking.vehicleType] : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <Detail label="Booked" value={formatDateTime(booking.createdAt)} />
              <Detail label="Pickup" value={booking.pickupAddress} />
              <Detail label="Destination" value={booking.destinationAddress} />
              <Detail label="Fare" value={formatPesoOrDash(displayFare(booking))} />
              <div className="detail-item">
                <dt>Passenger</dt>
                <dd>
                  {booking.passengerId ? (
                    <Link className="btn-link" to={`/passengers/${booking.passengerId}#booking-${booking.bookingId}`}>
                      {detail.passengerName || '(no name)'}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="detail-item">
                <dt>Driver</dt>
                <dd>
                  {booking.driverId ? (
                    <Link className="btn-link" to={`/driver-accounts/${booking.driverId}`}>
                      {detail.driverName || '(no name)'}
                    </Link>
                  ) : (
                    <span className="muted">No driver</span>
                  )}
                </dd>
              </div>
            </dl>
            {booking.bookingType === 'out_of_area' && (
              <p>
                <Link className="btn-link" to={`/out-of-area/${booking.bookingId}`}>
                  View the out-of-area request
                </Link>
              </p>
            )}
          </>
        ) : (
          <p className="muted">The booking {complaint.bookingId || ''} could not be found.</p>
        )}
      </div>

      <section className="card" aria-labelledby="complaint-review-title">
        <h3 id="complaint-review-title">Review</h3>
        {complaint.updatedBy && (
          <p className="muted small">
            Last changed {formatDateTime(complaint.updatedAt)} by {detail.updatedByEmail ?? complaint.updatedBy}
          </p>
        )}
        {message && (
          <div className="alert-success" role="status">
            {message}
          </div>
        )}
        <label className="field filter-field" htmlFor="complaint-status">
          <span>Status</span>
          <select
            id="complaint-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
            disabled={saving}
          >
            {COMPLAINT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {COMPLAINT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="complaint-notes">
          <span>Admin notes (only admins see these)</span>
          <textarea
            id="complaint-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-invalid={notesTooLong ? true : undefined}
            disabled={saving}
          />
          <span className="hint">
            {notesTooLong ? (
              <span className="field-error">At most {MAX_ADMIN_NOTES_LENGTH} characters.</span>
            ) : (
              `${notesTrimmed.length}/${MAX_ADMIN_NOTES_LENGTH}`
            )}
          </span>
        </label>
        <div className="button-row">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setSaveError(null);
              setMessage(null);
              setConfirming(true);
            }}
            disabled={saving || notesTooLong || (!statusChanged && !notesChanged)}
          >
            Save…
          </button>
          {(statusChanged || notesChanged) && (
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setStatus(complaint.status);
                setNotes(complaint.adminNotes);
              }}
              disabled={saving}
            >
              Discard changes
            </button>
          )}
        </div>
      </section>

      {confirming && (
        <ConfirmDialog
          title="Save this complaint?"
          confirmLabel="Save"
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirming(false)}
        >
          <table className="change-table">
            <tbody>
              <tr className={statusChanged ? 'changed' : 'unchanged'}>
                <td>Status</td>
                <td>
                  {statusChanged
                    ? `${COMPLAINT_STATUS_LABELS[complaint.status]} → ${COMPLAINT_STATUS_LABELS[status]}`
                    : `${COMPLAINT_STATUS_LABELS[status]} (unchanged)`}
                </td>
              </tr>
              <tr className={notesChanged ? 'changed' : 'unchanged'}>
                <td>Admin notes</td>
                <td>{notesChanged ? (notesTrimmed ? 'Updated' : 'Cleared') : 'Unchanged'}</td>
              </tr>
            </tbody>
          </table>
          {notesChanged && notesTrimmed && <blockquote className="remarks-quote">{notesTrimmed}</blockquote>}
          {statusChanged && (
            <p className="small">
              The {complaint.reporterRole ?? 'reporter'} sees the new status in the app. They do not see the notes.
            </p>
          )}
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </>
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
