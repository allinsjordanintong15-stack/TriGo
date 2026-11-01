import { bookingStatusBadge, type AdminBooking } from '../bookings/bookings';

/** A booking's status pill. Shows "Expired" for a standard booking no driver accepted in time. */
export function BookingStatusBadge({ booking }: { booking: AdminBooking }) {
  const { label, className } = bookingStatusBadge(booking);
  return <span className={`booking-status ${className}`}>{label}</span>;
}
