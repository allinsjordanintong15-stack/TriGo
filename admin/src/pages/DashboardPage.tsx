import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { BOOKING_STATUS_LABELS, displayFare, type AdminBooking } from '../bookings/bookings';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageHeader } from '../components/PageHeader';
import {
  CHART_DAYS,
  loadCommissionAlerts,
  loadLiveNow,
  loadMoneySummary,
  loadRecentBookings,
  loadRecentDays,
  type RecentBooking,
} from '../dashboard/dashboard';
import { useAdminCounts } from '../lib/adminCounts';
import { formatCentavos, formatCount, formatDateTime, formatPeso, formatTime, plural } from '../lib/format';
import { ColumnChart, type ColumnDatum } from '../reports/ColumnChart';

// Admin home: what needs attention, what is happening now, today's numbers, the last
// 7 days, recent bookings and money. Ordered so the attention cards and today's numbers
// fit in the first screen of a 1366×768 laptop. Each section loads on its own, so one slow
// query doesn't blank the page; Refresh reloads every section and the sidebar badges.

const CHART_HEIGHT = 160;

const DATE = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Today's bookings show the time only; older ones the date too. */
function bookingTime(date: Date | null): string {
  return date && date.toDateString() === new Date().toDateString() ? formatTime(date) : formatDateTime(date);
}

type Section<T> = { data: T | null; error: boolean };

/** Loads one section; reloads whenever `refreshKey` changes, keeping old data until then. */
function useSection<T>(load: () => Promise<T>, refreshKey: number): Section<T> {
  const [state, setState] = useState<Section<T>>({ data: null, error: false });
  useEffect(() => {
    let active = true;
    setState({ data: null, error: false });
    load().then(
      (data) => active && setState({ data, error: false }),
      () => active && setState({ data: null, error: true }),
    );
    return () => {
      active = false;
    };
  }, [load, refreshKey]);
  return state;
}

function SectionError() {
  return <p className="field-error">Could not load this. Check your connection and press Refresh.</p>;
}

/** The booking's own page: the out-of-area request, else the passenger's booking history. */
function bookingLink(booking: AdminBooking): string {
  if (booking.bookingType === 'out_of_area' && booking.outOfAreaRequestId) {
    return `/out-of-area/${encodeURIComponent(booking.outOfAreaRequestId)}`;
  }
  return `/passengers/${encodeURIComponent(booking.passengerId)}#booking-${booking.bookingId}`;
}

export function DashboardPage() {
  const { admin } = useAuth();
  const { counts, refreshCounts } = useAdminCounts();
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(() => new Date());

  // The loaders are module functions (stable), called with no arguments: "now" each time.
  const alerts = useSection(loadCommissionAlerts, refreshKey);
  const live = useSection(loadLiveNow, refreshKey);
  const days = useSection(loadRecentDays, refreshKey);
  const recent = useSection(loadRecentBookings, refreshKey);
  const money = useSection(loadMoneySummary, refreshKey);

  function refresh() {
    setNow(new Date());
    setRefreshKey((key) => key + 1);
    refreshCounts();
  }

  const today = days.data?.days[days.data.days.length - 1];
  const behind = alerts.data ? alerts.data.suspended + alerts.data.overdue : null;

  const tripsData: ColumnDatum[] = (days.data?.days ?? []).map((day) => ({
    key: day.period.isoStart,
    label: day.period.label,
    longLabel: day.period.longLabel,
    value: day.completedTrips,
  }));
  const commissionData: ColumnDatum[] = (days.data?.days ?? []).map((day) => ({
    key: day.period.isoStart,
    label: day.period.label,
    longLabel: day.period.longLabel,
    value: day.commissionCentavos / 100,
  }));
  const weekTrips = tripsData.reduce((total, d) => total + d.value, 0);
  const weekCommission = (days.data?.days ?? []).reduce((total, d) => total + d.commissionCentavos, 0);

  return (
    <div className="stack dashboard">
      <PageHeader
        // The display name when the admin account has one; never the email.
        title={`${greeting(now)}, ${admin?.displayName?.trim() || 'Admin'}`}
        subtitle={DATE.format(now)}
        actions={
          <button type="button" className="btn-outline" onClick={refresh}>
            Refresh
          </button>
        }
      />

      <section aria-labelledby="attention-title">
        <h3 id="attention-title" className="dashboard-heading">
          Needs your attention
        </h3>
        <div className="attention-grid">
          <AttentionCard
            label="Pending payments"
            count={counts?.pendingPayments ?? null}
            to="/earnings"
          />
          <AttentionCard
            label="Driver applications"
            count={counts?.pendingApplications ?? null}
            to="/drivers"
          />
          <AttentionCard
            label="Open complaints"
            count={counts?.openComplaints ?? null}
            to="/reports/complaints?status=open"
          />
          <AttentionCard
            label="Drivers behind on commission"
            count={behind}
            error={alerts.error}
            detail={
              alerts.data && behind
                ? `${formatCount(alerts.data.suspended)} suspended · ${formatCount(alerts.data.overdue)} overdue`
                : undefined
            }
            to="/earnings?balances=behind#balances"
          />
        </div>
      </section>

      <div className="dashboard-tiles">
        <section className="card tile-panel" aria-labelledby="today-title">
          <h3 id="today-title" className="dashboard-heading">
            Today
          </h3>
          {days.error ? (
            <SectionError />
          ) : !today || !days.data ? (
            <LoadingBlock label="Loading today's numbers…" lines={2} />
          ) : (
            <div className="tile-grid">
              <Tile label="Completed trips" value={formatCount(today.completedTrips)} />
              <Tile label="Fares collected" value={formatPeso(today.fares)} />
              <Tile label="Commission" title="Commission recorded today" value={formatCentavos(today.commissionCentavos)} />
              <Tile label="Cancelled" title="Cancelled bookings" value={formatCount(days.data.cancelledToday)} />
            </div>
          )}
        </section>

        <section className="card tile-panel" aria-labelledby="live-title">
          <h3 id="live-title" className="dashboard-heading">
            Live now
          </h3>
          {live.error ? (
            <SectionError />
          ) : !live.data ? (
            <LoadingBlock label="Loading live numbers…" lines={2} />
          ) : (
            <div className="tile-grid">
              <Tile label="Online" title="Drivers online" value={formatCount(live.data.online)} />
              <Tile label="Available" title="Online and available for requests" value={formatCount(live.data.available)} />
              <Tile label="On a trip" value={formatCount(live.data.onTrip)} />
              <Tile
                label="Open requests"
                title={`${plural(live.data.openRequests.standard, 'standard booking')} pending, ${plural(
                  live.data.openRequests.outOfArea,
                  'out-of-area request',
                )} searching`}
                value={formatCount(live.data.openRequests.outOfArea + live.data.openRequests.standard)}
                detail={`${formatCount(live.data.openRequests.outOfArea)} out-of-area`}
              />
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="week-title">
        <h3 id="week-title" className="dashboard-heading">
          Last {CHART_DAYS} days
        </h3>
        <div className="chart-grid dashboard-charts">
          <div className="card">
            <div className="chart-title">
              <h4>Completed trips</h4>
              {days.data && <span className="muted small">{plural(weekTrips, 'trip')}</span>}
            </div>
            {days.error ? (
              <SectionError />
            ) : !days.data ? (
              <LoadingBlock label="Loading trips chart…" lines={4} />
            ) : (
              <ColumnChart
                data={tripsData}
                integer
                height={CHART_HEIGHT}
                formatValue={(value) => plural(value, 'trip')}
                ariaLabel={`Completed trips per day, last ${CHART_DAYS} days. ${weekTrips} in total.`}
              />
            )}
          </div>
          <div className="card">
            <div className="chart-title">
              <h4>Recorded commission</h4>
              {days.data && <span className="muted small">{formatCentavos(weekCommission)}</span>}
            </div>
            {days.error ? (
              <SectionError />
            ) : !days.data ? (
              <LoadingBlock label="Loading commission chart…" lines={4} />
            ) : (
              <ColumnChart
                data={commissionData}
                integer={false}
                height={CHART_HEIGHT}
                formatValue={formatPeso}
                ariaLabel={`Recorded commission per day, last ${CHART_DAYS} days. ${formatCentavos(weekCommission)} in total.`}
              />
            )}
          </div>
        </div>
      </section>

      <div className="dashboard-bottom">
        <section className="card" aria-labelledby="recent-title">
          <h3 id="recent-title">Recent activity</h3>
          {recent.error ? (
            <SectionError />
          ) : !recent.data ? (
            <LoadingBlock label="Loading recent bookings…" lines={5} />
          ) : recent.data.length === 0 ? (
            <EmptyState>No bookings yet.</EmptyState>
          ) : (
            <RecentTable rows={recent.data} />
          )}
        </section>

        <section className="card money-card" aria-labelledby="money-title">
          <h3 id="money-title">Commission money</h3>
          {money.error ? (
            <SectionError />
          ) : !money.data ? (
            <LoadingBlock label="Loading money summary…" lines={3} />
          ) : (
            <dl className="money-list">
              <div>
                <dt>Collected</dt>
                <dd>{formatCentavos(money.data.collectedCentavos)}</dd>
              </div>
              <div>
                <dt>Cashed out</dt>
                <dd>{formatCentavos(money.data.cashedOutCentavos)}</dd>
              </div>
              <div className="money-available">
                <dt>Available</dt>
                <dd>{formatCentavos(money.data.availableCentavos)}</dd>
              </div>
            </dl>
          )}
          <Link to="/earnings" className="btn-link">
            Open Earnings →
          </Link>
        </section>
      </div>
    </div>
  );
}

function AttentionCard({
  label,
  count,
  to,
  detail,
  error = false,
}: {
  label: string;
  count: number | null;
  to: string;
  detail?: string;
  error?: boolean;
}) {
  const waiting = count !== null && count > 0;
  return (
    <div className={`card attention-card${waiting ? ' attention-waiting' : ''}`}>
      <div className="attention-label">{label}</div>
      {error ? (
        <SectionError />
      ) : count === null ? (
        <LoadingBlock label={`Loading ${label.toLowerCase()}…`} lines={1} />
      ) : waiting ? (
        <>
          <div className="attention-row">
            <span className="attention-count">{formatCount(count)}</span>
            <Link to={to} className="attention-link" aria-label={`Review ${label.toLowerCase()}`}>
              Review →
            </Link>
          </div>
          {detail && <div className="attention-detail">{detail}</div>}
        </>
      ) : (
        <div className="attention-clear">All clear</div>
      )}
    </div>
  );
}

/** `title` (full wording) shows on hover when the label is shortened to fit one row. */
function Tile({ label, value, detail, title }: { label: string; value: string; detail?: ReactNode; title?: string }) {
  return (
    <div className="tile" title={title}>
      <div className="stat-label tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {detail && <div className="tile-detail">{detail}</div>}
    </div>
  );
}

function RecentTable({ rows }: { rows: RecentBooking[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table recent-table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Passenger → driver</th>
            <th scope="col">Route</th>
            <th scope="col">Status</th>
            <th scope="col" className="num">Fare</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ booking, passengerName, driverName }) => (
            <tr key={booking.bookingId}>
              <td className="recent-time">
                <Link to={bookingLink(booking)}>{bookingTime(booking.createdAt)}</Link>
                {booking.bookingType === 'out_of_area' && <span className="tag">Out-of-area</span>}
              </td>
              <td>
                {passengerName || 'Unknown passenger'} →{' '}
                {booking.driverId ? driverName || 'Unknown driver' : <span className="muted">No driver yet</span>}
              </td>
              <td className="route-cell recent-route">
                {booking.pickupAddress || '—'} → {booking.destinationAddress || '—'}
              </td>
              <td>
                <span className={`booking-status booking-status-${booking.status ?? 'unknown'}`}>
                  {booking.status ? BOOKING_STATUS_LABELS[booking.status] : 'Unknown'}
                </span>
              </td>
              <td className="num">{formatPeso(displayFare(booking))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
