import type { ReactNode } from 'react';

/** A short, honest notice about how something works (e.g. "Cash-outs are recorded only…"). */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="alert-warning notice" role="note">
      {children}
    </div>
  );
}
