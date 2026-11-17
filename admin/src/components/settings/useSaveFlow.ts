import { useCallback, useState } from 'react';

/**
 * Review → save → toast state shared by the Settings forms. `save` runs the write; a stale
 * error (someone else saved first) shows its own message in the review dialog, any other
 * failure shows `failMessage`.
 */
export function useSaveFlow({
  successMessage,
  failMessage,
  isStale,
}: {
  successMessage: string;
  failMessage: string;
  isStale: (error: unknown) => boolean;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const openReview = useCallback(() => {
    setSaveError(null);
    setReviewing(true);
  }, []);
  const closeReview = useCallback(() => setReviewing(false), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);
  const hideToast = useCallback(() => setToast(null), []);

  /** Runs `write`, then `after` (e.g. reload); returns true when saved. */
  const save = useCallback(
    async (write: () => Promise<void>, after?: () => Promise<void> | void): Promise<boolean> => {
      setSaving(true);
      setSaveError(null);
      try {
        await write();
      } catch (error) {
        setSaveError(isStale(error) && error instanceof Error ? error.message : failMessage);
        setSaving(false);
        return false;
      }
      setReviewing(false);
      setToast(successMessage);
      try {
        await after?.();
      } finally {
        setSaving(false);
      }
      return true;
    },
    [failMessage, isStale, successMessage],
  );

  return { reviewing, openReview, closeReview, saving, saveError, clearSaveError, save, toast, hideToast };
}
