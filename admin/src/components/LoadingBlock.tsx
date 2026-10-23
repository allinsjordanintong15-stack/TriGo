/** Placeholder lines while a section loads; the label is read by screen readers. */
export function LoadingBlock({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="skeleton-line" aria-hidden="true" />
      ))}
    </div>
  );
}
