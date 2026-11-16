import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import {
  BOOKING_TYPE_LABELS,
  displayFare,
  fareBasisLabel,
  PAYMENT_METHOD_LABELS,
  VEHICLE_TYPE_LABELS,
} from '../bookings/bookings';
import { BookingStatusBadge } from '../components/BookingStatusBadge';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { TechnicalDetails } from '../components/TechnicalDetails';
import { formatDate, formatDateTime, formatPeso } from '../lib/format';
import { loadPassengerDetail, type PassengerDetail } from '../passengers/passengers';
import { WarningsCard } from '../warnings/WarningsCard';

const APPLICATION_LABELS = { pending: 'Pending', approved: 'Approved (also a driver)', rejected: 'Rejected' } as const;

export function PassengerDetailPage() {
  const { uid = '' } = useParams();
  const [detail, setDetail] = useState<PassengerDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setDetail(await loadPassengerDetail(uid));
    } catch {
      setLoadError('Could not load this passenger. Check your connection and reload the page.');
    }
  }, [uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Links like /passengers/{uid}#booking-{id} (Out-of-Area Trips) scroll to that booking
  // once the history has rendered, and highlight it.
  const { hash } = useLocation();
  useEffect(() => {
    if (!detail || !hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'center' });
  }, [detail, hash]);

  const backLink = (
    <Link to="/passengers" className="back-link">
      ← Back to passengers
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
        <LoadingBlock label="Loading passenger…" lines={5} />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="stack">
        {backLink}
        <PageHeader title="Passenger not found" subtitle="This account has no profile, or the link is incomplete." />
      </div>
    );
  }

  const { passenger, bookings, driverApplicationStatus } = detail;
  const completed = bookings.filter((b) => b.status === 'completed');
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
  const active = bookings.length - completed.length - cancelled;
  const faresPaid = Math.round(completed.reduce((total, b) => total + (b.finalFare ?? 0), 0) * 100) / 100;

  return (
    <div className="stack">
      {backLink}

      <PageHeader
        title={passenger.fullName || '(no name)'}
        subtitle="Passenger. Their contact details, warnings and every booking they made, newest first."
        actions={detail.role !== 'passenger' && <span className="tag">Role: {detail.role || 'unknown'}</span>}
      />

      <div className="card">
        <dl className="detail-grid">
          <Detail label="Email" value={passenger.email} />
          <Detail label="Mobile number" value={passenger.mobileNumber} mono />
          <Detail label="Joined" value={formatDate(passenger.createdAt)} />
          <Detail
            label="Driver application"
            value={driverApplicationStatus ? APPLICATION_LABELS[driverApplicationStatus] : 'None'}
          />
        </dl>
      </div>

      <WarningsCard uid={passenger.uid} role="passenger" />

      <div className="stat-grid">
        <Stat label="Bookings" value={String(bookings.length)} />
        <Stat label="Completed" value={String(completed.length)} />
        <Stat label="Cancelled" value={String(cancelled)} />
        <Stat label="Active" value={String(active)} />
        <Stat label="Fares paid (completed)" value={formatPeso(faresPaid)} />
      </div>

      <div className="card">
        <h3>Booking history</h3>
        {bookings.length === 0 ? (
          <EmptyState>No bookings yet.</EmptyState>
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
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr
                    key={booking.bookingId}
                    id={`booking-${booking.bookingId}`}
                    className={hash === `#booking-${booking.bookingId}` ? 'row-linked' : undefined}
                  >
                    <td>
                      <div>{formatDateTime(booking.createdAt)}</div>
                    </td>
                    <td>
                      <div>{booking.bookingType ? BOOKING_TYPE_LABELS[booking.bookingType] : '—'}</div>
                      <div className="muted small">
                        {booking.vehicleType ? VEHICLE_TYPE_LABELS[booking.vehicleType] : ''}
                      </div>
                    </td>
                    <td className="route-cell">
                      <div>
                        <span className="muted small">From </span>
                        {booking.pickupAddress || '—'}
                      </div>
                      <div>
                        <span className="muted small">To </span>
                        {booking.destinationAddress || '—'}
                      </div>
                      {booking.distanceKm !== null && (
                        <div className="muted small">{booking.distanceKm.toFixed(1)} km</div>
                      )}
                    </td>
                    <td>
                      <BookingStatusBadge booking={booking} />
                      {booking.status === 'cancelled' && (
                        <div className="muted small">
                          {booking.cancelledBy ? `by ${booking.cancelledBy}` : ''}
                          {booking.cancellationReason ? ` — ${booking.cancellationReason}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="num">
                      <div>{formatPeso(displayFare(booking))}</div>
                      <div className="muted small" title="Fare basis">
                        {fareBasisLabel(booking)}
                      </div>
                    </td>
                    <td>{booking.paymentMethod ? PAYMENT_METHOD_LABELS[booking.paymentMethod] : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TechnicalDetails rows={[['User ID', passenger.uid]]} />
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
