import type { ReactNode } from 'react';

/** What a list or table shows when it has nothing in it. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
