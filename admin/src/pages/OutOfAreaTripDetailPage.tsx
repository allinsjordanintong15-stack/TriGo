import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  BOOKING_STATUS_LABELS,
  displayFare,
  PAYMENT_METHOD_LABELS,
  VEHICLE_TYPE_LABELS,
} from '../bookings/bookings';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime, formatPeso } from '../lib/format';
import { loadOutOfAreaTripDetail, type OutOfAreaTripDetail } from '../outOfArea/outOfAreaRequests';
import { buildTimeline, DISPLAY_STATUS_LABELS, displayStatus } from '../outOfArea/requests';

export function OutOfAreaTripDetailPage() {
  const { requestId = '' } = useParams();
  const [detail, setDetail] = useState<OutOfAreaTripDetail | null | undefined>(undefined);
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const loaded = await loadOutOfAreaTripDetail(requestId);
      setDetail(loaded);
      setLoadedAt(new Date());
    } catch {
      setLoadError('Could not load this request. Check your connection and reload the page.');
    }
  }, [requestId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const backLink = (
    <Link to="/out-of-area" className="back-link">
      ← Back to out-of-area trips
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
        <LoadingBlock label="Loading request…" lines={5} />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="stack">
        {backLink}
        <PageHeader title="Request not found" subtitle="There is no out-of-area request with this ID." />
      </div>
    );
  }

  const { request, booking } = detail;
  const status = displayStatus(request, loadedAt);
  const timeline = buildTimeline(request, booking, loadedAt);

  return (
    <div className="stack">
      {backLink}

      <PageHeader
        title="Out-of-area request"
        subtitle={<span className="mono small">{request.requestId}</span>}
        actions={
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        }
      />

      <div className="card">
        <p>
          <span className={`booking-status request-status-${status}`}>{DISPLAY_STATUS_LABELS[status]}</span>
          {booking?.status && (
            <>
              {' '}
              <span className="muted small">Trip:</span>{' '}
              <span className={`booking-status booking-status-${booking.status}`}>
                {BOOKING_STATUS_LABELS[booking.status]}
              </span>
            </>
          )}
        </p>
        <dl className="detail-grid">
          <Detail label="Pickup" value={request.pickupAddress} />
          <Detail label="Destination" value={request.destinationAddress} />
          <Detail label="Distance" value={request.distanceKm !== null ? `${request.distanceKm.toFixed(1)} km` : ''} />
          <Detail label="Vehicle" value={request.vehicleType ? VEHICLE_TYPE_LABELS[request.vehicleType] : ''} />
          <Detail label="Fare (per-km, final)" value={formatPeso(request.fare)} />
          <Detail label="Requested" value={formatDateTime(request.createdAt)} />
        </dl>
      </div>

      <div className="detail-columns">
        <div className="card">
          <h3>Passenger</h3>
          <dl className="detail-grid">
            <div className="detail-item">
              <dt>Name</dt>
              <dd>
                {request.passengerId ? (
                  <Link className="btn-link" to={`/passengers/${request.passengerId}`}>
                    {detail.passengerName || '(no name)'}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <Detail label="Mobile number" value={detail.passengerMobile} mono />
          </dl>
        </div>

        <div className="card">
          <h3>Driver</h3>
          {detail.driverId ? (
            <dl className="detail-grid">
              <Detail label="Name" value={detail.driverName || '(no name)'} />
              <Detail label="Mobile number" value={detail.driverMobile} mono />
              <Detail label="Plate" value={detail.vehiclePlate} mono />
            </dl>
          ) : (
            <p className="muted">No driver has accepted this request.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Booking</h3>
        {booking ? (
          <>
            <dl className="detail-grid">
              <Detail label="Booking ID" value={booking.bookingId} mono />
              <Detail label="Status" value={booking.status ? BOOKING_STATUS_LABELS[booking.status] : 'Unknown'} />
              <Detail label="Fare" value={formatPeso(displayFare(booking))} />
              <Detail label="Payment" value={booking.paymentMethod ? PAYMENT_METHOD_LABELS[booking.paymentMethod] : ''} />
            </dl>
            {booking.passengerId && (
              <p>
                <Link className="btn-link" to={`/passengers/${booking.passengerId}#booking-${booking.bookingId}`}>
                  View this booking in the passenger's history
                </Link>
              </p>
            )}
          </>
        ) : (
          <p className="muted">No booking yet. It is created when the passenger confirms a driver.</p>
        )}
      </div>

      <div className="card">
        <h3>Timeline</h3>
        {timeline.length === 0 ? (
          <p className="muted">No recorded times.</p>
        ) : (
          <ol className="timeline">
            {timeline.map((event, index) => (
              <li key={`${event.label}-${index}`}>
                <div className="timeline-time">{formatDateTime(event.at)}</div>
                <div className="cell-strong">{event.label}</div>
                {event.detail && <div className="muted small">{event.detail}</div>}
              </li>
            ))}
          </ol>
        )}
        <p className="muted small">Only recorded times are shown.</p>
      </div>
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
