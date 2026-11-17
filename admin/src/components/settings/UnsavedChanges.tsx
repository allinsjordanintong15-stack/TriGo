import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';

import { unsavedChangesLabel } from '../../settings/settingsDiff';
import { ConfirmDialog } from '../ConfirmDialog';

// Unsaved-changes guard for the Settings tabs. Each form registers how many unsaved changes
// it has; while any has some, leaving its URL (another Settings tab, the sidebar, back/
// forward) asks first, and refreshing or closing the browser tab shows the browser's prompt.
// useBlocker needs the data router (createBrowserRouter in App.tsx).

type Entry = { label: string; count: number; discard: () => void };

type Registry = {
  set: (id: string, entry: Entry) => void;
  remove: (id: string) => void;
};

const UnsavedChangesContext = createContext<Registry | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const dirty = useMemo(() => Object.values(entries).filter((entry) => entry.count > 0), [entries]);
  const hasUnsaved = dirty.length > 0;

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => hasUnsaved && currentLocation.pathname !== nextLocation.pathname,
      [hasUnsaved],
    ),
  );

  useEffect(() => {
    if (!hasUnsaved) return undefined;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older browsers show the prompt only when returnValue is set.
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsaved]);

  const registry = useMemo<Registry>(
    () => ({
      set: (id, entry) =>
        setEntries((prev) => {
          const old = prev[id];
          if (old && old.count === entry.count && old.label === entry.label && old.discard === entry.discard) {
            return prev;
          }
          return { ...prev, [id]: entry };
        }),
      remove: (id) =>
        setEntries((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        }),
    }),
    [],
  );

  const total = dirty.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <UnsavedChangesContext.Provider value={registry}>
      {children}
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="Leave without saving?"
          confirmLabel="Discard and leave"
          cancelLabel="Stay"
          danger
          onConfirm={() => {
            dirty.forEach((entry) => entry.discard());
            blocker.proceed();
          }}
          onCancel={() => blocker.reset()}
        >
          <p>
            You have {unsavedChangesLabel(total)} on {dirty.map((entry) => entry.label).join(', ')}. They will be
            lost if you leave.
          </p>
        </ConfirmDialog>
      )}
    </UnsavedChangesContext.Provider>
  );
}

/**
 * Registers a form's unsaved-change count with the nearest UnsavedChangesProvider (a no-op
 * outside one). `discard` resets the form when the admin chooses "Discard and leave".
 */
export function useUnsavedChanges(id: string, label: string, count: number, discard: () => void) {
  const registry = useContext(UnsavedChangesContext);
  const discardRef = useRef(discard);
  useEffect(() => {
    discardRef.current = discard;
  });
  const stableDiscard = useCallback(() => discardRef.current(), []);

  useEffect(() => {
    registry?.set(id, { label, count, discard: stableDiscard });
  }, [registry, id, label, count, stableDiscard]);

  useEffect(() => () => registry?.remove(id), [registry, id]);
}
