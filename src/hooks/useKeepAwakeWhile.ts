import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

/**
 * Keeps the screen on while `active` (e.g. during an active trip) and releases it when
 * `active` turns false or the screen unmounts. `tag` keeps this lock separate from others.
 * Failures are ignored: the screen then just sleeps as usual.
 */
export function useKeepAwakeWhile(active: boolean, tag: string): void {
  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(tag).catch(() => undefined);
    return () => {
      deactivateKeepAwake(tag).catch(() => undefined);
    };
  }, [active, tag]);
}
