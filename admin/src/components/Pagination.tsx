import { pageNumbers } from '../drivers/driverTable';

/** Previous / page numbers / Next under a table. Hidden when everything fits on one page. */
export function Pagination({
  page,
  pageCount,
  onChange,
  label,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** e.g. "Drivers pages", read by screen readers. */
  label: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pagination" aria-label={label}>
      <button type="button" className="pagination-button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      {pageNumbers(page, pageCount).map((n, index) =>
        n === 'gap' ? (
          <span key={`gap-${index}`} className="pagination-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className="pagination-button"
            aria-current={n === page ? 'page' : undefined}
            aria-label={`Page ${n}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        className="pagination-button"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
