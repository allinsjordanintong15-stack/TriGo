import { useEffect, useState } from 'react';

/**
 * The current time (ms), refreshed every `intervalMs` while `enabled`. Used to drop
 * requests that expire while a screen is open and to keep "5 min ago" labels current.
 */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, enabled]);

  return now;
}
