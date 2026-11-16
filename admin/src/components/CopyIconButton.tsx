import { useEffect, useState } from 'react';

/**
 * A 16px copy icon (no text) with a "Copy" tooltip; shows ✓ for a moment after copying.
 * `label` names what is copied for screen readers ("Copy mobile number").
 */
export function CopyIconButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 1500);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  const title = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy';
  return (
    <button
      type="button"
      className={`copy-icon-button${state === 'copied' ? ' copied' : ''}`}
      onClick={() => void copy()}
      title={title}
      aria-label={`${title === 'Copy' ? 'Copy' : title}: ${label}`}
    >
      {state === 'copied' ? (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      )}
    </button>
  );
}
