import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// "One card edited at a time" on a page of independent settings cards (System tab): while a
// card has unsaved changes (or an open form), the other cards are disabled.

type Lock = {
  owner: { key: string; label: string } | null;
  setDirty: (key: string, label: string, dirty: boolean) => void;
};

const CardLockContext = createContext<Lock | null>(null);

export function CardLockProvider({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState<Lock['owner']>(null);
  // Stable, so the cards' effects run only when their own dirty state changes.
  const setDirty = useCallback((key: string, label: string, dirty: boolean) => {
    setOwner((prev) => {
      if (dirty) return prev ?? { key, label };
      return prev?.key === key ? null : prev;
    });
  }, []);
  const value = useMemo<Lock>(() => ({ owner, setDirty }), [owner, setDirty]);
  return <CardLockContext.Provider value={value}>{children}</CardLockContext.Provider>;
}

/**
 * Reports whether this card is being edited; returns the label of the other card that is
 * (so this one should be disabled), or null.
 */
export function useCardLock(key: string, label: string, dirty: boolean): string | null {
  const lock = useContext(CardLockContext);
  const setDirty = lock?.setDirty;
  useEffect(() => {
    setDirty?.(key, label, dirty);
  }, [setDirty, key, label, dirty]);
  useEffect(() => () => setDirty?.(key, label, false), [setDirty, key, label]);
  const owner = lock?.owner;
  return owner && owner.key !== key ? owner.label : null;
}

export function CardLockNote({ lockedBy }: { lockedBy: string | null }) {
  if (!lockedBy) return null;
  return (
    <p className="settings-lock-note" role="status">
      Save or discard your changes to {lockedBy} first.
    </p>
  );
}
