import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { RATING_TAGS } from '../../../src/constants/rating.ts';
import {
  BOOKING_TYPE_LABELS,
  displayFare,
  fareBasisLabel,
  PAYMENT_METHOD_LABELS,
  VEHICLE_TYPE_LABELS,
} from '../bookings/bookings';
import { loadBookingDetail, type BookingDetail } from '../bookings/bookingList';
import {
  BOOKING_ROW_STATUS_LABELS,
  bookingRowStatus,
  bookingTimeline,
  isDriverNoShow,
} from '../bookings/bookingsTable';
import { COMPLAINT_CATEGORY_LABELS, COMPLAINT_STATUS_LABELS, tabForRole } from '../complaints/complaints';
import { Avatar } from '../components/Avatar';
import { CopyIconButton } from '../components/CopyIconButton';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import { TechnicalDetails } from '../components/TechnicalDetails';
import { formatCentavos, formatDateTime, formatPeso } from '../lib/format';

const TAG_LABELS = new Map<string, string>(RATING_TAGS.map((tag) => [tag.id, tag.label]));

/** /trips/bookings/:bookingId: one booking, read only. */
export function BookingDetailPage() {
  const { bookingId = '' } = useParams();
  const [detail, setDetail] = useState<BookingDetail | null | undefined>(undefined);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setDetail(await loadBookingDetail(bookingId));
      setLoadedAt(Date.now());
    } catch (error) {
      console.error('Booking failed to load:', error);
      setLoadError('Could not load this booking. Check your connection and try again.');
    }
  }, [bookingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const backLink = (
    <Link to="/trips/bookings" className="back-link">
      ← Back to bookings
    </Link>
  );

  if (loadError) {
    return (
      <div className="stack">
        {backLink}
        <div className="list-error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (detail === undefined) {
    return (
      <div className="card">
        <LoadingBlock label="Loading booking…" lines={6} />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="stack">
        {backLink}
        <PageHeader title="Booking not found" subtitle="This booking doesn't exist, or the link is incomplete." />
      </div>
    );
  }

  const { booking, passenger, driver, commission, rating, complaints } = detail;
  const status = bookingRowStatus(booking, loadedAt);
  const timeline = bookingTimeline(booking, loadedAt);
  const type = booking.bookingType ? BOOKING_TYPE_LABELS[booking.bookingType] : 'Booking';
  const basis = fareBasisLabel(booking);

  return (
    <div className="stack">
      {backLink}

      <PageHeader
        title={`${type} booking${passenger?.name ? ` for ${passenger.name}` : ''}`}
        subtitle={`Booked ${formatDateTime(booking.createdAt)}.`}
        actions={
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        }
      />

      <div className="card booking-summary">
        <div className="booking-summary-status">
          <span className={`trip-pill trip-pill-${status}`}>{BOOKING_ROW_STATUS_LABELS[status]}</span>
          {status === 'cancelled' && isDriverNoShow(booking.cancellationReason) && (
            <span className="muted small">Driver no-show</span>
          )}
        </div>
        <div className="route-mini cell-text booking-route">
          <div className="route-mini-line">
            <span className="route-dot" aria-hidden="true" />
            <span>
              <span className="visually-hidden">From </span>
              {booking.pickupAddress || '—'}
            </span>
          </div>
          <div className="route-mini-line">
            <svg className="route-pin" viewBox="0 0 12 16" width="10" height="13" aria-hidden="true">
              <path d="M6 0a6 6 0 0 0-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 0 0-6-6zm0 8.2A2.2 2.2 0 1 1 6 3.8a2.2 2.2 0 0 1 0 4.4z" />
            </svg>
            <span>
              <span className="visually-hidden">To </span>
              {booking.destinationAddress || '—'}
            </span>
          </div>
        </div>
        <dl className="detail-grid">
          <Detail label="Type" value={type} />
          <Detail label="Vehicle" value={booking.vehicleType ? VEHICLE_TYPE_LABELS[booking.vehicleType] : ''} />
          <Detail label="Distance" value={booking.distanceKm !== null ? `${booking.distanceKm.toFixed(1)} km` : ''} />
          {booking.outOfAreaRequestId && (
            <div className="detail-item">
              <dt>Out-of-area request</dt>
              <dd>
                <Link className="list-name" to={`/trips/out-of-area/${encodeURIComponent(booking.outOfAreaRequestId)}`}>
                  Open the request
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="detail-columns">
        <PersonCard
          title="Passenger"
          person={passenger}
          to={passenger ? `/passengers/${encodeURIComponent(passenger.uid)}` : null}
          empty="No passenger on record."
        />
        <PersonCard
          title="Driver"
          person={driver}
          to={driver ? `/drivers/all/${encodeURIComponent(driver.uid)}` : null}
          extra={driver?.vehiclePlate ? `Plate ${driver.vehiclePlate}` : undefined}
          empty="No driver took this booking."
        />
      </div>

      <div className="detail-columns">
        <section className="card" aria-labelledby="fare-heading">
          <h3 id="fare-heading">Fare</h3>
          <dl className="fare-breakdown">
            <FareLine label="Fare basis" value={basis ?? 'Per-km rate (out-of-area, final)'} />
            {booking.fareBasis === 'per_km' && booking.perKmRate !== null && booking.distanceKm !== null && (
              <FareLine
                label="Per-km"
                value={`${formatPeso(booking.perKmRate)}/km × ${booking.distanceKm.toFixed(1)} km`}
              />
            )}
            <FareLine label="Estimated fare" value={formatPeso(booking.estimatedFare)} />
            <FareLine label="Final fare" value={booking.finalFare !== null ? formatPeso(booking.finalFare) : 'Not completed'} strong />
            <FareLine label="Payment" value={booking.paymentMethod ? PAYMENT_METHOD_LABELS[booking.paymentMethod] : '—'} />
            <FareLine
              label="Commission recorded"
              value={
                commission
                  ? `${formatCentavos(commission.amountCentavos)}${commission.percentage !== null ? ` (${commission.percentage}%)` : ''}`
                  : booking.status === 'completed'
                    ? 'None (no commission set at the time)'
                    : '—'
              }
            />
          </dl>
          {status !== 'completed' && <p className="muted small">Shown fare: {formatPeso(displayFare(booking))}.</p>}
        </section>

        <section className="card" aria-labelledby="rating-heading">
          <h3 id="rating-heading">Rating</h3>
          {rating ? (
            <>
              <p className="rating-cell" title={`${rating.stars} out of 5`}>
                <span className="rating-stars" aria-hidden="true">
                  {'★'.repeat(rating.stars)}
                  <span className="star-empty">{'★'.repeat(5 - rating.stars)}</span>
                </span>
                <strong>{rating.stars} / 5</strong>
                {rating.createdAt && <span className="muted small">{formatDateTime(rating.createdAt)}</span>}
              </p>
              {rating.tags.length > 0 && (
                <div className="tag-list">
                  {rating.tags.map((tag) => (
                    <span key={tag} className="rating-tag">
                      {TAG_LABELS.get(tag) ?? tag}
                    </span>
                  ))}
                </div>
              )}
              {rating.comment && <blockquote className="remarks-quote">{rating.comment}</blockquote>}
            </>
          ) : (
            <p className="muted">{booking.status === 'completed' ? 'The passenger has not rated this trip.' : 'Only completed trips can be rated.'}</p>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="timeline-heading">
        <h3 id="timeline-heading">Timeline</h3>
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
      </section>

      <section className="card" aria-labelledby="complaints-heading">
        <h3 id="complaints-heading">Complaints about this booking</h3>
        {complaints.length === 0 ? (
          <p className="muted">No complaints.</p>
        ) : (
          <ul className="history-list">
            {complaints.map((complaint) => {
              const tab = tabForRole(complaint.reporterRole);
              const by = complaint.reporterRole === 'driver' ? 'By the driver' : 'By the passenger';
              return (
                <li key={complaint.complaintId} className="history-item">
                  <div className="history-line">
                    {tab ? (
                      <Link className="list-name" to={`/complaints/${tab}/${encodeURIComponent(complaint.complaintId)}`}>
                        {complaint.category ? COMPLAINT_CATEGORY_LABELS[complaint.category] : 'Complaint'}
                      </Link>
                    ) : (
                      <span className="cell-strong">Complaint</span>
                    )}
                    <span className="muted small">{by}</span>
                    <span className="muted small">{COMPLAINT_STATUS_LABELS[complaint.status]}</span>
                    <span className="muted small">{formatDateTime(complaint.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <TechnicalDetails
        rows={[
          ['Booking ID', booking.bookingId],
          ['Out-of-area request ID', booking.outOfAreaRequestId ?? ''],
          ['Passenger user ID', booking.passengerId],
          ['Driver user ID', booking.driverId ?? ''],
        ]}
      />
    </div>
  );
}

function PersonCard({
  title,
  person,
  to,
  extra,
  empty,
}: {
  title: string;
  person: { uid: string; name: string; mobileNumber: string } | null;
  to: string | null;
  extra?: string;
  empty: string;
}) {
  return (
    <section className="card person-card" aria-label={title}>
      <h3>{title}</h3>
      {person && to ? (
        <div className="driver-cell">
          <Avatar name={person.name} imageUrl={null} />
          <div className="cell-text">
            <Link className="list-name" to={to}>
              {person.name || '(no name)'}
            </Link>
            {person.mobileNumber && (
              <span className="contact-line">
                <span>{person.mobileNumber}</span>
                <CopyIconButton text={person.mobileNumber} label="mobile number" />
              </span>
            )}
            {extra && <span className="muted small">{extra}</span>}
          </div>
        </div>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}

function FareLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="fare-line">
      <dt>{label}</dt>
      <dd className={strong ? 'cell-strong' : undefined}>{value}</dd>
    </div>
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
