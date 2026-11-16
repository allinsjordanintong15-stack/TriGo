import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { displayFare, isBookingExpired } from '../bookings/bookings';
import { loadDriverSuspension } from '../drivers/drivers';
import { useAdminCounts } from '../lib/adminCounts';
import { formatDateTime, formatPeso } from '../lib/format';
import { loadComplaintWarning } from '../warnings/warnings';
import { tripStatusText } from './complaintText';
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  loadComplaintDetail,
  reviewComplaint,
  ROLE_LABELS,
  tabForRole,
  type ComplaintDetail,
} from './complaints';
import { outcomeText } from './complaintsTable';
import { PersonStanding } from './PersonStanding';
import { ResolvePanel } from './ResolvePanel';

type Loaded = {
  detail: ComplaintDetail;
  warningExists: boolean;
  /** The reported driver's admin suspension; null when not a driver or no record. */
  suspension: { suspended: boolean; until: Date | null } | null;
};

/**
 * Right-hand panel for one complaint (the list keeps its ID in the URL, so a refresh reopens
 * it). Esc or ✕ closes. Opening an Open complaint marks it In review once.
 */
export function ComplaintDrawer({
  complaintId,
  onClose,
  onListChanged,
}: {
  complaintId: string;
  onClose: () => void;
  /** The complaint's status or outcome changed: reload the list and counts. */
  onListChanged: () => void;
}) {
  const { admin } = useAuth();
  const { refreshCounts } = useAdminCounts();
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const markedRef = useRef<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const detail = await loadComplaintDetail(complaintId);
      if (!detail) {
        setLoaded(null);
        return;
      }
      const [warning, suspension] = await Promise.all([
        loadComplaintWarning(complaintId).catch(() => null),
        detail.reported?.role === 'driver' ? loadDriverSuspension(detail.reported.uid).catch(() => null) : Promise.resolve(null),
      ]);
      setLoaded({ detail, warningExists: warning !== null, suspension });
    } catch (error) {
      console.error('Complaint failed to load:', error);
      setLoadError('Could not load this complaint. Check your connection and try again.');
    }
  }, [complaintId]);

  useEffect(() => {
    setLoaded(undefined);
    setMessage(null);
    void load();
  }, [load]);

  // An Open complaint becomes In review the first time it is opened here.
  useEffect(() => {
    const complaint = loaded?.detail.complaint;
    if (!complaint || !admin || complaint.status !== 'open' || markedRef.current === complaint.complaintId) return;
    markedRef.current = complaint.complaintId;
    reviewComplaint(
      complaint.complaintId,
      admin.uid,
      { status: 'open', adminNotes: complaint.adminNotes },
      { status: 'in_review', adminNotes: complaint.adminNotes },
    )
      .then(() => {
        refreshCounts();
        onListChanged();
        void load();
      })
      .catch((error: unknown) => console.error('Could not mark the complaint In review:', error));
  }, [loaded, admin, refreshCounts, onListChanged, load]);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      // A dialog on top handles its own Escape.
      if (event.key === 'Escape' && !document.querySelector('.dialog-backdrop')) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tab = loaded ? tabForRole(loaded.detail.complaint.reporterRole) : null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-top">
          {tab ? (
            <Link className="small" to={`/complaints/${tab}/${encodeURIComponent(complaintId)}`}>
              Open full page ↗
            </Link>
          ) : (
            <span />
          )}
          <button ref={closeRef} type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {loadError ? (
          <div className="list-error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="btn-outline" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : loaded === undefined ? (
          <div className="drawer-body" aria-busy="true">
            <h2 id="drawer-title" className="visually-hidden">
              Loading complaint
            </h2>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-line" />
            ))}
          </div>
        ) : loaded === null ? (
          <div className="drawer-body">
            <h2 id="drawer-title">Complaint not found</h2>
            <p className="muted">It may have been removed, or the link is incomplete.</p>
          </div>
        ) : (
          <DrawerBody
            loaded={loaded}
            message={message}
            onChanged={(text) => {
              setMessage(text);
              onListChanged();
              void load();
            }}
          />
        )}
      </aside>
    </div>
  );
}

function DrawerBody({
  loaded,
  message,
  onChanged,
}: {
  loaded: Loaded;
  message: string | null;
  onChanged: (message: string) => void;
}) {
  const { detail, warningExists, suspension } = loaded;
  const { complaint, booking, reported } = detail;
  const reporterName = detail.reporterName || 'Someone';
  const reportedName = reported ? reported.name || 'someone without a name' : null;
  const counted = typeof complaint.reportedUserId === 'string' && complaint.reportedUserId !== '';
  const outcome = complaint.status === 'resolved' ? outcomeText(complaint.outcome) : null;

  return (
    <div className="drawer-body">
      <header className="drawer-header">
        <h2 id="drawer-title">
          {reporterName}
          {complaint.reporterRole && <span className="role-label">{ROLE_LABELS[complaint.reporterRole]}</span>}
          {reportedName ? ' reported ' : ' reported a problem'}
          {reportedName}
          {reported && <span className="role-label">{ROLE_LABELS[reported.role]}</span>}
        </h2>
        <div className="drawer-meta">
          <span className={`complaint-pill complaint-pill-${complaint.status}`}>{COMPLAINT_STATUS_LABELS[complaint.status]}</span>
          {outcome && <span className="muted small">{outcome}</span>}
          <span className="muted small">{formatDateTime(complaint.createdAt)}</span>
        </div>
      </header>

      {message && (
        <div className="alert-success" role="status">
          {message}
        </div>
      )}

      <section className="drawer-section" aria-labelledby="drawer-what">
        <h3 id="drawer-what">What happened</h3>
        <p className="cell-strong">{complaint.category ? COMPLAINT_CATEGORY_LABELS[complaint.category] : 'Complaint'}</p>
        <blockquote className="remarks-quote complaint-message">{complaint.message || '—'}</blockquote>
      </section>

      <section className="drawer-section" aria-labelledby="drawer-trip">
        <h3 id="drawer-trip">The trip</h3>
        {booking ? (
          <>
            <p className="muted small">{formatDateTime(booking.createdAt)}</p>
            <p>
              {booking.pickupAddress || '—'} → {booking.destinationAddress || '—'}
            </p>
            <p className="small">
              {formatPeso(displayFare(booking))} · {tripStatusText(booking.status, isBookingExpired(booking))}
            </p>
            <Link className="small" to={`/trips/bookings/${encodeURIComponent(booking.bookingId)}`}>
              View trip →
            </Link>
          </>
        ) : (
          <p className="muted">The trip for this complaint could not be found.</p>
        )}
      </section>

      {reported && (
        <section className="drawer-section" aria-labelledby="drawer-about">
          <h3 id="drawer-about">About {reportedName}</h3>
          <p className="small">
            <PersonStanding uid={reported.uid} role={reported.role} counted={counted} />
          </p>
          {suspension?.suspended && (
            <p className="small suspended-note">
              Suspended {suspension.until ? `until ${formatDateTime(suspension.until)}` : 'until lifted'}.
            </p>
          )}
          <Link
            className="small"
            to={reported.role === 'driver' ? `/drivers/all/${encodeURIComponent(reported.uid)}` : `/passengers/${encodeURIComponent(reported.uid)}`}
          >
            Open {reported.role === 'driver' ? 'driver' : 'passenger'} profile →
          </Link>
        </section>
      )}
      {!reported && (
        <section className="drawer-section">
          <p className="muted small">No driver was assigned to this trip, so nobody else is named.</p>
        </section>
      )}

      <ResolvePanel key={`${complaint.complaintId}:${complaint.status}`} detail={detail} warningExists={warningExists} onChanged={onChanged} />
    </div>
  );
}
