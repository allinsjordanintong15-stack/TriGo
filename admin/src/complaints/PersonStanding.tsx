import { useEffect, useState } from 'react';

import { loadWarningsFor } from '../warnings/warnings';
import { countComplaintsAgainst, type ComplaintRole } from './complaints';
import { complaintCountText, OLDER_COMPLAINT_NOTE, warningCountText } from './complaintText';

type Loaded = { key: string; complaints: number | null; warnings: number | null };

/**
 * "2 complaints · 1 warning" about one person in one role, in plain words. `counted` is false
 * for a complaint filed before 10 Nov 2026 (it doesn't store who was reported, so the count
 * leaves it out); the sentence then says so instead of "no complaints".
 */
export function PersonStanding({ uid, role, counted }: { uid: string; role: ComplaintRole; counted: boolean }) {
  const key = `${uid}:${role}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      countComplaintsAgainst(uid, role).catch(() => null),
      loadWarningsFor(uid, role)
        .then((warnings) => warnings.filter((w) => w.status === 'active').length)
        .catch(() => null),
    ]).then(([complaints, warnings]) => {
      if (!cancelled) setLoaded({ key, complaints, warnings });
    });
    return () => {
      cancelled = true;
    };
  }, [uid, role, key]);

  const current = loaded?.key === key ? loaded : null;
  if (!current) return <span className="muted">Loading…</span>;

  const complaintPart =
    current.complaints === null ? 'Complaints could not be loaded' : complaintCountText(current.complaints, counted);
  const warningPart = current.warnings === null ? 'warnings could not be loaded' : warningCountText(current.warnings);
  return (
    <>
      <strong>
        {complaintPart} · {warningPart}
      </strong>
      {!counted && <div className="muted small">{OLDER_COMPLAINT_NOTE}</div>}
    </>
  );
}
