import { getOwnRating, RatingServiceError } from '@/services/ratingService';
import { Rating } from '@/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export type OwnRatingState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rating: Rating | null };

/** The passenger's rating of one trip (null = not rated yet), with retry and a local set. */
export function useOwnRating(bookingId: string | null, enabled = true) {
  const [state, setState] = useState<OwnRatingState>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (!bookingId || !enabled) return;
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', rating: await getOwnRating(bookingId) });
    } catch (err) {
      setState({
        kind: 'error',
        message:
          err instanceof RatingServiceError ? err.message : 'Unable to load your rating. Please try again.',
      });
    }
  }, [bookingId, enabled]);

  // On focus, so Booking Details shows the rating just given on the Rate driver screen.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** After submitting: show the saved rating without reading it again. */
  const setRated = useCallback((rating: Rating) => setState({ kind: 'ready', rating }), []);

  return { state, reload: load, setRated };
}
