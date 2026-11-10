import { useEffect, useState } from 'react';

import { countComplaintsAgainst, type ComplaintRole } from './complaints';
import { complaintCountLabel } from './reportedParty';

/**
 * A detail-grid row: complaints against this person in this role (one Firestore count).
 * Complaints from before 2026-11-10 don't store who was reported, so they aren't counted.
 */
export function ComplaintsAgainst({ uid, as }: { uid: string; as: ComplaintRole }) {
  const [state, setState] = useState<{ key: string; count: number | null; failed: boolean } | null>(null);
  const key = `${uid}:${as}`;

  useEffect(() => {
    let cancelled = false;
    countComplaintsAgainst(uid, as).then(
      (count) => !cancelled && setState({ key, count, failed: false }),
      () => !cancelled && setState({ key, count: null, failed: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [uid, as, key]);

  const current = state?.key === key ? state : null;
  return (
    <div className="detail-item">
      <dt>Complaints against them ({as === 'driver' ? 'as driver' : 'as passenger'})</dt>
      <dd>
        {!current ? '…' : current.failed ? <span className="muted">Could not load</span> : complaintCountLabel(current.count ?? 0)}
        <div className="muted small">Counted from complaints filed since 10 Nov 2026.</div>
      </dd>
    </div>
  );
}
