import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import {
  BOOKING_STATUS_LABELS,
  BOOKING_TYPE_LABELS,
  displayFare,
  fareBasisLabel,
  PAYMENT_METHOD_LABELS,
  VEHICLE_TYPE_LABELS,
} from '../bookings/bookings';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { VehicleDetailsFields } from '../components/VehicleDetailsFields';
import {
  DRIVER_VEHICLE_TYPES,
  DUTY_LABELS,
  dutyStatus,
  hasVehicleDetailErrors,
  MAX_VERIFICATION_NOTE_LENGTH,
  normalizeVehicleDetails,
  normalizeVehiclePlate,
  validateVehicleDetails,
  validateVehiclePlate,
  VERIFICATION_BADGE_CLASS,
  VERIFICATION_LABELS,
  verificationStatus,
  type DriverVehicleType,
  type VehicleDetails,
} from '../drivers/driverRecords';
import {
  loadDriverDetail,
  restoreDriver,
  revokeDriver,
  TRIP_HISTORY_LIMIT,
  updateDriverVehicle,
  VehicleConflictError,
  VerificationConflictError,
  type DriverDetail,
} from '../drivers/drivers';
import { formatDateTime, formatPeso } from '../lib/format';

type Action = 'revoke' | 'restore' | 'vehicle';

const DETAIL_LABELS: Record<keyof VehicleDetails, string> = {
  vehicleBrand: 'Brand',
  vehicleModel: 'Model',
  vehicleColor: 'Color',
};

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
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [vehicleType, setVehicleType] = useState<DriverVehicleType>('tricycle');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [plateTouched, setPlateTouched] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState<VehicleDetails>({
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
  });
  const [detailsTouched, setDetailsTouched] = useState(false);

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
    return (
      <div className="card">
        <LoadingBlock label="Loading driver…" lines={5} />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="stack">
        {backLink}
        <PageHeader title="Driver not found" subtitle="There is no driver record for this account." />
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

  const plateError = validateVehiclePlate(vehiclePlate);
  const newPlate = normalizeVehiclePlate(vehiclePlate);
  const typeChanged = vehicleType !== driver.vehicleType;
  const plateChanged = newPlate !== driver.vehiclePlate;
  const detailErrors = validateVehicleDetails(vehicleDetails);
  const newDetails = normalizeVehicleDetails(vehicleDetails);
  const detailKeys = Object.keys(DETAIL_LABELS) as (keyof VehicleDetails)[];
  const detailsChanged = detailKeys.some((key) => newDetails[key] !== driver[key]);
  const missingDetails = detailKeys.some((key) => driver[key] === null);
  // The rules refuse vehicle changes while the driver has a trip or request.
  const vehicleLocked = duty === 'on_trip' || duty === 'holding_request';

  function startVehicleEdit() {
    if (!detail) return;
    setVehicleType(detail.driver.vehicleType ?? 'tricycle');
    setVehiclePlate(detail.driver.vehiclePlate);
    setPlateTouched(false);
    // Empty for records approved before these existed; saving requires all three.
    setVehicleDetails({
      vehicleBrand: detail.driver.vehicleBrand ?? '',
      vehicleModel: detail.driver.vehicleModel ?? '',
      vehicleColor: detail.driver.vehicleColor ?? '',
    });
    setDetailsTouched(false);
    setSaveError(null);
    setMessage(null);
    setEditingVehicle(true);
  }

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
      } else if (action === 'restore') {
        await restoreDriver(detail.driver.uid, admin.uid);
        setMessage(`${detail.driver.fullName}'s verification was restored. They can go online in the app.`);
      } else {
        await updateDriverVehicle(detail.driver.uid, { vehicleType, vehiclePlate, ...vehicleDetails });
        setMessage(`${detail.driver.fullName}'s vehicle details were updated.`);
        setEditingVehicle(false);
      }
      setAction(null);
      setSaving(false);
      await reload();
    } catch (error) {
      const denied = (error as { code?: string }).code === 'permission-denied';
      setSaveError(
        error instanceof VerificationConflictError || error instanceof VehicleConflictError
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

      <PageHeader
        title={driver.fullName || '(no name)'}
        subtitle="Driver"
        actions={
          <span className={`status-badge ${VERIFICATION_BADGE_CLASS[verification]}`}>{VERIFICATION_LABELS[verification]}</span>
        }
      />

      <div className="card">
        <dl className="detail-grid">
          <Detail label="Email" value={contact?.email ?? ''} />
          <Detail label="Mobile number" value={contact?.mobileNumber ?? ''} mono />
          <Detail label="Plate number" value={driver.vehiclePlate} mono />
          <div className="detail-item">
            <dt>Vehicle type</dt>
            <dd>
              {driver.vehicleType ? (
                VEHICLE_TYPE_LABELS[driver.vehicleType]
              ) : (
                <span className="status-badge status-rejected">Invalid vehicle type</span>
              )}
            </dd>
          </div>
          <Detail label="Brand" value={driver.vehicleBrand ?? 'Not set'} />
          <Detail label="Model" value={driver.vehicleModel ?? 'Not set'} />
          <Detail label="Color" value={driver.vehicleColor ?? 'Not set'} />
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
              View passenger profile
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
            <p className="muted small">Revoking takes the driver offline until you restore them. They can still sign in.</p>
            {duty === 'on_trip' && <Notice>This driver is on a trip. They can still finish it after you revoke.</Notice>}
            {duty === 'holding_request' && (
              <Notice>This driver holds an out-of-area request. If you revoke, the passenger is sent back to searching.</Notice>
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

      <section className="card review-panel" aria-labelledby="vehicle-heading">
        <h3 id="vehicle-heading">Vehicle details</h3>
        {vehicleLocked ? (
          <p className="muted small">
            {duty === 'on_trip'
              ? 'This driver is on a trip. Vehicle details can be edited after the trip ends.'
              : 'This driver is holding an out-of-area request. Vehicle details can be edited after it ends.'}
          </p>
        ) : !editingVehicle ? (
          <>
            <p className="muted small">
              Correct the vehicle type, plate number, brand, model or color shown to passengers.
            </p>
            {missingDetails && (
              <Notice>
                This driver was approved before brand, model and color were recorded. Passengers see only the
                vehicle type and plate until you add them.
              </Notice>
            )}
            <button type="button" className="btn-outline" onClick={startVehicleEdit} disabled={saving}>
              Edit vehicle details
            </button>
          </>
        ) : (
          <>
            <label className="field" htmlFor="vehicle-type">
              <span>Vehicle type</span>
              <select
                id="vehicle-type"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as DriverVehicleType)}
                disabled={saving}
              >
                {DRIVER_VEHICLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {VEHICLE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="vehicle-plate">
              <span>Plate number</span>
              <input
                id="vehicle-plate"
                className="mono"
                value={vehiclePlate}
                onChange={(e) => {
                  setVehiclePlate(e.target.value);
                  setPlateTouched(true);
                }}
                aria-invalid={plateTouched && plateError ? true : undefined}
                autoComplete="off"
                disabled={saving}
              />
              <span className="hint">
                {plateTouched && plateError ? (
                  <span className="field-error">{plateError}</span>
                ) : (
                  'Saved in capitals, e.g. ABC 1234.'
                )}
              </span>
            </label>
            <VehicleDetailsFields
              idPrefix="vehicle"
              value={vehicleDetails}
              onChange={(value) => {
                setVehicleDetails(value);
                setDetailsTouched(true);
              }}
              errors={detailErrors}
              showErrors={detailsTouched}
              disabled={saving}
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setEditingVehicle(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setPlateTouched(true);
                  setDetailsTouched(true);
                  if (plateError || hasVehicleDetailErrors(detailErrors)) return;
                  setSaveError(null);
                  setMessage(null);
                  setAction('vehicle');
                }}
                disabled={saving || (!typeChanged && !plateChanged && !detailsChanged)}
              >
                Save vehicle details…
              </button>
            </div>
          </>
        )}
      </section>

      <div className="stat-grid">
        <Stat label={detail.tripsTruncated ? `Trips (latest ${TRIP_HISTORY_LIMIT})` : 'Trips'} value={String(trips.length)} />
        <Stat label="Completed" value={String(completed.length)} />
        <Stat label="Cancelled" value={String(cancelled)} />
        <Stat label="Fares (completed)" value={formatPeso(fares)} />
      </div>

      <div className="card">
        <h3>Trip history</h3>
        {detail.tripsTruncated && (
          <p className="alert-warning" role="status">
            Latest {TRIP_HISTORY_LIMIT} trips shown; totals above count only these.
          </p>
        )}
        {trips.length === 0 ? (
          <EmptyState>No trips yet.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="data-table booking-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">Route</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Fare</th>
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
                    <td className="num">
                      <div>{formatPeso(displayFare(trip))}</div>
                      <div className="muted small" title="Fare basis">
                        {fareBasisLabel(trip)}
                      </div>
                    </td>
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
          danger
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

      {action === 'vehicle' && (
        <ConfirmDialog
          title={`Update ${driver.fullName}'s vehicle?`}
          confirmLabel="Save vehicle details"
          busy={saving}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setAction(null)}
        >
          <table className="change-table">
            <tbody>
              <tr className={typeChanged ? 'changed' : 'unchanged'}>
                <td>Vehicle type</td>
                <td>
                  {typeChanged
                    ? `${driver.vehicleType ? VEHICLE_TYPE_LABELS[driver.vehicleType] : 'Invalid'} → ${VEHICLE_TYPE_LABELS[vehicleType]}`
                    : VEHICLE_TYPE_LABELS[vehicleType]}
                </td>
              </tr>
              <tr className={plateChanged ? 'changed' : 'unchanged'}>
                <td>Plate number</td>
                <td className="mono">{plateChanged ? `${driver.vehiclePlate || '—'} → ${newPlate}` : newPlate}</td>
              </tr>
              {detailKeys.map((key) => {
                const changed = newDetails[key] !== driver[key];
                return (
                  <tr key={key} className={changed ? 'changed' : 'unchanged'}>
                    <td>{DETAIL_LABELS[key]}</td>
                    <td>{changed ? `${driver[key] ?? '—'} → ${newDetails[key]}` : newDetails[key]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
