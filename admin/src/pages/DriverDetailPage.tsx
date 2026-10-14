import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import {
  BOOKING_STATUS_LABELS,
  BOOKING_TYPE_LABELS,
  displayFare,
  formatDateTime,
  formatPesoOrDash,
  PAYMENT_METHOD_LABELS,
  VEHICLE_TYPE_LABELS,
} from '../bookings/bookings';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  DUTY_LABELS,
  dutyStatus,
  MAX_VERIFICATION_NOTE_LENGTH,
  VERIFICATION_BADGE_CLASS,
  VERIFICATION_LABELS,
  verificationStatus,
} from '../drivers/driverRecords';
import {
  loadDriverDetail,
  restoreDriver,
  revokeDriver,
  TRIP_HISTORY_LIMIT,
  VerificationConflictError,
  type DriverDetail,
} from '../drivers/drivers';

type Action = 'revoke' | 'restore';

export function DriverDetailPage() {
  const { uid = '' } = useParams();
  const { admin } = useAuth();
  const [detail, setDetail] = useState<DriverDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setDetail(await loadDriverDetail(uid));
    } catch {
      setLoadError('Could not load this driver. Check your connection and reload the page.');
    }
  }, [uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const backLink = (
    <Link to="/driver-accounts" className="back-link">
      ← Back to drivers
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

  if (detail === undefined) {
    return <div className="card muted">Loading driver…</div>;
  }

  if (detail === null) {
    return (
      <div className="stack">
        {backLink}
        <div className="card">
          <h2>Driver not found</h2>
          <p className="muted">There is no driver record for this account.</p>
        </div>
      </div>
    );
  }

  const { driver, contact, trips } = detail;
  const verification = verificationStatus(driver);
  const duty = dutyStatus(driver);
  const completed = trips.filter((trip) => trip.status === 'completed');
  const cancelled = trips.filter((trip) => trip.status === 'cancelled').length;
  const fares = Math.round(completed.reduce((total, trip) => total + (trip.finalFare ?? 0), 0) * 100) / 100;

  const reasonTrimmed = reason.trim();
  const reasonError = !reasonTrimmed
    ? 'A reason is required. Other admins see it on this page.'
    : reasonTrimmed.length > MAX_VERIFICATION_NOTE_LENGTH
      ? `At most ${MAX_VERIFICATION_NOTE_LENGTH} characters.`
      : null;

  async function handleConfirm() {
    if (!detail || !action || !admin) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (action === 'revoke') {
        await revokeDriver(detail.driver.uid, admin.uid, reason);
        setMessage(`${detail.driver.fullName}'s verification was revoked. They are offline and cannot accept bookings.`);
        setReason('');
        setReasonTouched(false);
      } else {
        await restoreDriver(detail.driver.uid, admin.uid);
        setMessage(`${detail.driver.fullName}'s verification was restored. They can go online in the app.`);
      }
      setAction(null);
      setSaving(false);
      await reload();
    } catch (error) {
      const denied = (error as { code?: string }).code === 'permission-denied';
      setSaveError(
        error instanceof VerificationConflictError
          ? error.message
          : denied
            ? 'The change was refused. Reload the page and try again.'
            : 'Could not save the change. Check your connection and try again.',
      );
      setSaving(false);
    }
  }

  const changedBy = detail.verificationUpdatedByEmail ?? driver.verificationUpdatedBy;

  return (
    <div className="stack">
      {backLink}

      {message && (
        <div className="alert-success" role="status">
          {message}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>{driver.fullName || '(no name)'}</h2>
          <span className={`status-badge ${VERIFICATION_BADGE_CLASS[verification]}`}>{VERIFICATION_LABELS[verification]}</span>
        </div>
        <dl className="detail-grid">
          <Detail label="Email" value={contact?.email ?? ''} />
          <Detail label="Mobile number" value={contact?.mobileNumber ?? ''} mono />
          <Detail label="Plate number" value={driver.vehiclePlate} mono />
          <Detail label="Vehicle type" value={driver.vehicleType ? VEHICLE_TYPE_LABELS[driver.vehicleType] : 'Unknown'} />
          <Detail label="Rating" value={driver.rating ? driver.rating.toFixed(1) : 'No ratings yet'} />
          <Detail label="Now" value={DUTY_LABELS[duty]} />
          <Detail
            label="Account"
            value={detail.role === 'passenger' ? 'Passenger with an approved driver application' : detail.role === 'driver' ? 'Driver account' : detail.role || 'No user profile'}
          />
        </dl>
        {detail.role === 'passenger' && (
          <p className="small">
            <Link className="btn-link" to={`/passengers/${driver.uid}`}>
              View their passenger profile and bookings
            </Link>
          </p>
        )}
      </div>

      <section className="card review-panel" aria-labelledby="verification-heading">
        <h3 id="verification-heading">Verification</h3>
        {driver.verificationUpdatedAt && (
          <p className="muted small">
            Last {driver.isVerified ? 'restored' : 'revoked'} {formatDateTime(driver.verificationUpdatedAt)}
            {changedBy ? ` by ${changedBy}` : ''}.
          </p>
        )}
        {driver.verificationNote && (
          <div className="remarks-box">
            <div className="remarks-label">Reason for revoking</div>
            <p>{driver.verificationNote}</p>
          </div>
        )}

        {driver.isVerified ? (
          <>
            <p className="muted small">
              Revoking takes the driver offline at once. They can still sign in, but cannot go online or accept
              bookings until verification is restored.
            </p>
            {duty === 'on_trip' && (
              <div className="alert-warning" role="note">
                This driver is on a trip. They can still finish it after you revoke.
              </div>
            )}
            {duty === 'holding_request' && (
              <div className="alert-warning" role="note">
                This driver has accepted an out-of-area request. If the passenger confirms them anyway, the driver
                cannot take the booking and the passenger will have to cancel it.
              </div>
            )}
            <label className="field" htmlFor="revoke-reason">
              <span>Reason (required)</span>
              <textarea
                id="revoke-reason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonTouched(true);
                }}
                aria-invalid={reasonTouched && reasonError ? true : undefined}
                disabled={saving}
              />
              <span className="hint">
                {reasonTouched && reasonError ? (
                  <span className="field-error">{reasonError}</span>
                ) : (
                  `${reasonTrimmed.length}/${MAX_VERIFICATION_NOTE_LENGTH}`
                )}
              </span>
            </label>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                setReasonTouched(true);
                if (reasonError) return;
                setSaveError(null);
                setMessage(null);
                setAction('revoke');
              }}
              disabled={saving}
            >
              Revoke verification…
            </button>
          </>
        ) : (
          <>
            <p className="muted small">
              {verification === 'revoked'
                ? 'Restoring lets the driver go online and accept bookings again.'
                : 'This driver record was never verified. Verifying lets the driver go online and accept bookings.'}{' '}
              They stay offline until they go online in the app.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setSaveError(null);
                setMessage(null);
                setAction('restore');
              }}
              disabled={saving}
            >
              {verification === 'revoked' ? 'Restore verification…' : 'Verify driver…'}
            </button>
          </>
        )}
      </section>

      <div className="stat-grid">
        <Stat label={detail.tripsTruncated ? `Trips (latest ${TRIP_HISTORY_LIMIT})` : 'Trips'} value={String(trips.length)} />
        <Stat label="Completed" value={String(completed.length)} />
        <Stat label="Cancelled" value={String(cancelled)} />
        <Stat label="Fares (completed)" value={formatPesoOrDash(fares)} />
      </div>

      <div className="card">
        <h3>Trip history</h3>
        {detail.tripsTruncated && (
          <p className="alert-warning" role="status">
            Showing the latest {TRIP_HISTORY_LIMIT} trips. Older trips are not shown or counted above.
          </p>
        )}
        {trips.length === 0 ? (
          <p className="muted">No trips yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table booking-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">Route</th>
                  <th scope="col">Status</th>
                  <th scope="col">Fare</th>
                  <th scope="col">Payment</th>
                  <th scope="col">
                    <span className="visually-hidden">Passenger</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip.bookingId}>
                    <td>
                      <div>{formatDateTime(trip.createdAt)}</div>
                      <div className="muted small mono" title="Booking ID">
                        {trip.bookingId}
                      </div>
                    </td>
                    <td>
                      <div>{trip.bookingType ? BOOKING_TYPE_LABELS[trip.bookingType] : '—'}</div>
                      <div className="muted small">{trip.vehicleType ? VEHICLE_TYPE_LABELS[trip.vehicleType] : ''}</div>
                    </td>
                    <td className="route-cell">
                      <div>
                        <span className="muted small">From </span>
                        {trip.pickupAddress || '—'}
                      </div>
                      <div>
                        <span className="muted small">To </span>
                        {trip.destinationAddress || '—'}
                      </div>
                      {trip.distanceKm !== null && <div className="muted small">{trip.distanceKm.toFixed(1)} km</div>}
                    </td>
                    <td>
                      <span className={`booking-status booking-status-${trip.status ?? 'unknown'}`}>
                        {trip.status ? BOOKING_STATUS_LABELS[trip.status] : 'Unknown'}
                      </span>
                      {trip.status === 'cancelled' && (
                        <div className="muted small">
                          {trip.cancelledBy ? `by ${trip.cancelledBy}` : ''}
                          {trip.cancellationReason ? ` — ${trip.cancellationReason}` : ''}
                        </div>
                      )}
                    </td>
                    <td>{formatPesoOrDash(displayFare(trip))}</td>
                    <td>{trip.paymentMethod ? PAYMENT_METHOD_LABELS[trip.paymentMethod] : '—'}</td>
                    <td className="cell-action">
                      {trip.passengerId && (
                        <Link className="btn-link" to={`/passengers/${trip.passengerId}#booking-${trip.bookingId}`}>
                          Passenger
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {action === 'revoke' && (
        <ConfirmDialog
          title={`Revoke ${driver.fullName}'s verification?`}
          confirmLabel="Revoke verification"
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setAction(null)}
        >
          <table className="change-table">
            <tbody>
              <tr className="changed">
                <td>Verification</td>
                <td>Verified → Revoked</td>
              </tr>
              <tr className={driver.isOnline || driver.isAvailable ? 'changed' : undefined}>
                <td>Duty</td>
                <td>{driver.isOnline ? `${driver.isAvailable ? 'Available' : 'Online'} → Offline` : 'Offline'}</td>
              </tr>
            </tbody>
          </table>
          <p>Reason (shown to admins):</p>
          <blockquote className="remarks-quote">{reasonTrimmed}</blockquote>
          {duty === 'on_trip' && <p className="small">They can still finish their current trip.</p>}
          {saveError && (
            <div className="alert-error" role="alert">
              {saveError}
            </div>
          )}
        </ConfirmDialog>
      )}

      {action === 'restore' && (
        <ConfirmDialog
          title={`${verification === 'revoked' ? 'Restore' : 'Verify'} ${driver.fullName}?`}
          confirmLabel={verification === 'revoked' ? 'Restore verification' : 'Verify driver'}
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setAction(null)}
        >
          <p>
            Verification: {VERIFICATION_LABELS[verification]} → Verified. The driver can go online and accept bookings
            again{driver.verificationNote ? '; the revoke reason is cleared' : ''}.
          </p>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
