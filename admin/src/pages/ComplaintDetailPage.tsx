import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import {
  BOOKING_TYPE_LABELS,
  displayFare,
  isBookingExpired,
  VEHICLE_TYPE_LABELS,
} from '../bookings/bookings';
import { complaintStatusSentence, tripStatusText } from '../complaints/complaintText';
import { PersonStanding } from '../complaints/PersonStanding';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { TechnicalDetails } from '../components/TechnicalDetails';
import { PhoneNumber } from '../components/PhoneNumber';
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUSES,
  ComplaintConflictError,
  complaintTab,
  loadComplaintDetail,
  MAX_ADMIN_NOTES_LENGTH,
  reviewComplaint,
  ROLE_LABELS,
  tabForRole,
  type ComplaintDetail,
  type ComplaintStatus,
} from '../complaints/complaints';
import { useAdminCounts } from '../lib/adminCounts';
import { formatDate, formatDateTime, formatPeso } from '../lib/format';
import { ComplaintWarningPanel } from '../warnings/ComplaintWarningPanel';

export function ComplaintDetailPage() {
  const { complaintId = '', tab = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const listTab = complaintTab(tab)?.tab ?? 'against-drivers';
  const { admin } = useAuth();
  const { refreshCounts } = useAdminCounts();
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

  // Old links (/reports/complaints/:id) don't know the tab: once loaded, move the URL to the
  // tab this complaint belongs to (same page, no reload).
  const rightTab = detail ? tabForRole(detail.complaint.reporterRole) : null;
  useEffect(() => {
    if (rightTab && rightTab !== tab) {
      navigate(`/complaints/${rightTab}/${encodeURIComponent(complaintId)}${search}`, { replace: true });
    }
  }, [rightTab, tab, complaintId, search, navigate]);

  // Back to the list with the filter it was opened from.
  const fromStatus = COMPLAINT_STATUSES.find((s) => s === searchParams.get('from'));
  const backLink = (
    <Link to={`/complaints/${listTab}${fromStatus ? `?status=${fromStatus}` : ''}`} className="back-link">
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
    return (
      <div className="card">
        <LoadingBlock label="Loading complaint…" lines={5} />
      </div>
    );
  }

  if (detail === null) {
    return (
      <>
        {backLink}
        <PageHeader title="Complaint not found" subtitle="This complaint doesn't exist, or the link is incomplete." />
      </>
    );
  }

  const { complaint, booking, reported } = detail;
  const notesTrimmed = notes.trim();
  const notesTooLong = notesTrimmed.length > MAX_ADMIN_NOTES_LENGTH;
  const statusChanged = status !== complaint.status;
  const notesChanged = notesTrimmed !== complaint.adminNotes;

  const reporterName = detail.reporterName || 'Someone';
  const reporterRole = complaint.reporterRole ? ROLE_LABELS[complaint.reporterRole] : null;
  const reportedName = reported ? reported.name || 'someone without a name' : null;
  // Complaints filed before 2026-11-10 don't store who was reported (the page works it out
  // from the booking), so they aren't in the counts and can't lead to a warning.
  const counted = typeof complaint.reportedUserId === 'string' && complaint.reportedUserId !== '';

  const changedBy = !complaint.updatedBy
    ? null
    : complaint.updatedBy === admin?.uid
      ? 'you'
      : (detail.updatedByName ?? detail.updatedByEmail ?? 'another admin');
  const statusSentence = complaintStatusSentence(
    complaint.status,
    complaint.updatedAt ? formatDate(complaint.updatedAt) : null,
    changedBy,
  );

  const tripLink = booking
    ? booking.bookingType === 'out_of_area'
      ? `/trips/out-of-area/${encodeURIComponent(booking.bookingId)}`
      : booking.passengerId
        ? `/passengers/${encodeURIComponent(booking.passengerId)}#booking-${booking.bookingId}`
        : null
    : null;

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
      if (statusChanged) refreshCounts();
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

      <PageHeader
        title={
          <>
            {reporterName}
            {reporterRole && <span className="role-label">{reporterRole}</span>}
            {reportedName ? ' reported ' : ' reported a problem'}
            {reportedName}
            {reported && <span className="role-label">{ROLE_LABELS[reported.role]}</span>}
          </>
        }
        subtitle="A problem reported from a trip in the app. Read what happened, then choose what to do below."
        actions={
          <button type="button" className="btn-outline" onClick={() => void reload()} disabled={saving}>
            Refresh
          </button>
        }
      />

      <div className="card status-bar" role="status">
        <span className={`booking-status complaint-status-${complaint.status}`}>
          {COMPLAINT_STATUS_LABELS[complaint.status]}
        </span>
        <span>{statusSentence}</span>
      </div>

      <section className="card" aria-labelledby="complaint-what">
        <h3 id="complaint-what">What happened</h3>
        <dl className="detail-grid">
          <Detail label="Category" value={complaint.category ? COMPLAINT_CATEGORY_LABELS[complaint.category] : ''} />
          <Detail label="Reported on" value={formatDateTime(complaint.createdAt)} />
        </dl>
        <h4 className="complaint-message-title">In {reporterName}&apos;s words</h4>
        <blockquote className="remarks-quote complaint-message">{complaint.message || '—'}</blockquote>
      </section>

      <section className="card" aria-labelledby="complaint-trip">
        <h3 id="complaint-trip">The trip</h3>
        {booking ? (
          <>
            <dl className="detail-grid">
              <Detail label="When" value={formatDateTime(booking.createdAt)} />
              <Detail label="Route" value={`${booking.pickupAddress || '—'} → ${booking.destinationAddress || '—'}`} />
              <Detail label="Fare" value={formatPeso(displayFare(booking))} />
              <Detail label="What happened to the trip" value={tripStatusText(booking.status, isBookingExpired(booking))} />
              <Detail
                label="Kind of trip"
                value={[
                  booking.bookingType ? BOOKING_TYPE_LABELS[booking.bookingType] : null,
                  booking.vehicleType ? VEHICLE_TYPE_LABELS[booking.vehicleType] : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <Detail
                label="People"
                value={`${detail.passengerName || 'Passenger without a name'} (passenger)${
                  booking.driverId ? ` · ${detail.driverName || 'driver without a name'} (driver)` : ' · no driver'
                }`}
              />
            </dl>
            {tripLink && (
              <p>
                <Link className="btn-outline" to={tripLink}>
                  View trip
                </Link>
              </p>
            )}
          </>
        ) : (
          <p className="muted">The trip for this complaint could not be found. It may have been removed.</p>
        )}
      </section>

      {reported && (
        <section className="card" aria-labelledby="complaint-about">
          <h3 id="complaint-about">About {reportedName}</h3>
          <dl className="detail-grid">
            <Detail label="Role on this trip" value={ROLE_LABELS[reported.role]} />
            <div className="detail-item">
              <dt>Phone</dt>
              <dd>{detail.reportedPhone ? <PhoneNumber phone={detail.reportedPhone} /> : 'No phone number on file'}</dd>
            </div>
            <div className="detail-item detail-item-wide">
              <dt>On record (as {reported.role})</dt>
              <dd>
                <PersonStanding uid={reported.uid} role={reported.role} counted={counted} />
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="card review-panel" aria-labelledby="complaint-actions">
        <h3 id="complaint-actions">What you can do</h3>
        {message && (
          <div className="alert-success" role="status">
            {message}
          </div>
        )}

        <ComplaintWarningPanel key={complaint.complaintId} complaint={complaint} reported={reported} />

        {reported && (
          <div className="action-item">
            {reported.role === 'driver' ? (
              <>
                <h4>Revoke {reportedName}&apos;s verification</h4>
                <p className="action-help">
                  Stops them from taking trips until you restore it. You do this on their driver page, where you can also
                  see their trips and warnings.
                </p>
                <p>
                  <Link className="btn-outline" to={`/drivers/all/${encodeURIComponent(reported.uid)}`}>
                    Open driver page
                  </Link>
                </p>
              </>
            ) : (
              <>
                <h4>View {reportedName}&apos;s account</h4>
                <p className="action-help">Their bookings, complaints and warnings, all on one page.</p>
                <p>
                  <Link className="btn-outline" to={`/passengers/${encodeURIComponent(reported.uid)}`}>
                    Open passenger page
                  </Link>
                </p>
              </>
            )}
          </div>
        )}

        <div className="action-item">
          <h4>Mark resolved or update the status</h4>
          <p className="action-help">
            Choose a status and keep a private note. {reporterName} sees the status in the app, never your note.
          </p>
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
            <span>Admin note (only admins see this)</span>
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
        </div>
      </section>

      <TechnicalDetails
        rows={[
          ['Complaint ID', complaint.complaintId],
          ['Booking ID', complaint.bookingId],
          ['Reporter user ID', complaint.reporterId],
          ['Reported user ID', reported?.uid ?? ''],
          ['Last changed by (admin user ID)', complaint.updatedBy ?? ''],
        ]}
      />

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
                <td>Admin note</td>
                <td>{notesChanged ? (notesTrimmed ? 'Updated' : 'Cleared') : 'Unchanged'}</td>
              </tr>
            </tbody>
          </table>
          {notesChanged && notesTrimmed && <blockquote className="remarks-quote">{notesTrimmed}</blockquote>}
          {statusChanged && <p className="small">The reporter sees the status, not your note.</p>}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}
