import { useState } from 'react';

/**
 * Internal IDs, collapsed at the bottom of a page: only needed when looking something up in
 * the Firebase Console or asking for technical help. Empty values are left out; each row has
 * a Copy button.
 */
export function TechnicalDetails({ rows }: { rows: [label: string, value: string][] }) {
  const shown = rows.filter(([, value]) => value);
  if (shown.length === 0) return null;
  return (
    <details className="card technical-details">
      <summary>Technical details</summary>
      <p className="muted small">
        Internal IDs, only needed in the Firebase Console or when asking for technical help.
      </p>
      <dl className="detail-grid">
        {shown.map(([label, value]) => (
          <div className="detail-item" key={label}>
            <dt>{label}</dt>
            <dd>
              <span className="mono small">{value}</span> <CopyButton text={value} label={label} />
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      className="btn-link copy-button"
      onClick={() => void copy()}
      aria-label={`Copy ${label}`}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
    </button>
  );
}
