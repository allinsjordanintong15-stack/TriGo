import { useEffect, useRef, useState, type RefObject } from 'react';

import { compactNumber, niceTicks } from './reportMath';

// Single-series column chart in plain SVG (no chart library). One series, so no legend:
// the card title names it. Columns ≤ 24px with a 4px rounded cap on a square baseline,
// hairline grid, sparse x labels, and a tooltip per column on hover. The table view on the
// Reports page carries every value for keyboard and screen-reader users.

export type ColumnDatum = { key: string; label: string; longLabel: string; value: number };

type ColumnChartProps = {
  data: ColumnDatum[];
  /** Tooltip value text, e.g. "12 trips" or "₱1,234.00". */
  formatValue: (value: number) => string;
  /** Whole-number axis steps (counts). */
  integer: boolean;
  /** Summary for screen readers, e.g. "Completed trips per day, Oct 1 to Oct 30". */
  ariaLabel: string;
  /** Chart height in px (the Dashboard uses a shorter chart). */
  height?: number;
};

const DEFAULT_HEIGHT = 220;
const MARGIN = { top: 12, right: 8, bottom: 28, left: 44 };
const MAX_COLUMN = 24;
const MAX_X_LABELS = 8;
/** Room one x label needs ("Oct 21" at 11px plus a gap), so labels never overlap. */
const MIN_LABEL_SLOT = 34;

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Column outline: 4px rounded top corners, square at the baseline. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height);
  const bottom = y + height;
  return [
    `M${x},${bottom}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${bottom}`,
    'Z',
  ].join(' ');
}

export function ColumnChart({ data, formatValue, integer, ariaLabel, height = DEFAULT_HEIGHT }: ColumnChartProps) {
  const [containerRef, width] = useWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max, integer);
  const top = ticks[ticks.length - 1];
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const slot = data.length > 0 ? plotWidth / data.length : 0;
  // Leave at least a 2px surface gap between neighbouring columns.
  const columnWidth = Math.max(1, Math.min(MAX_COLUMN, slot * 0.7, slot - 2));
  const y = (value: number) => MARGIN.top + plotHeight - (top > 0 ? (value / top) * plotHeight : 0);
  const labelEvery = Math.max(
    1,
    Math.ceil(data.length / MAX_X_LABELS),
    slot > 0 ? Math.ceil(MIN_LABEL_SLOT / slot) : 1,
  );
  // x labels sit under the baseline, centred on their column.
  const labelY = MARGIN.top + plotHeight + 18;

  const hoveredDatum = hovered !== null ? data[hovered] : null;
  const tooltipLeft = hovered !== null ? MARGIN.left + slot * hovered + slot / 2 : 0;

  return (
    <div className="chart" ref={containerRef}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onMouseLeave={() => setHovered(null)}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="chart-gridline" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
              <text className="chart-axis-label" x={MARGIN.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                {compactNumber(tick)}
              </text>
            </g>
          ))}

          {data.map((datum, index) => {
            const x = MARGIN.left + slot * index + (slot - columnWidth) / 2;
            const columnHeight = MARGIN.top + plotHeight - y(datum.value);
            return (
              <g key={datum.key}>
                {columnHeight > 0 && (
                  <path
                    className={`chart-column${hovered === index ? ' chart-column-active' : ''}`}
                    d={columnPath(x, y(datum.value), columnWidth, columnHeight)}
                  />
                )}
                {index % labelEvery === 0 && (
                  <text className="chart-axis-label" x={MARGIN.left + slot * index + slot / 2} y={labelY} textAnchor="middle">
                    {datum.label}
                  </text>
                )}
                {/* Hit target: the whole slot, taller and wider than the column. */}
                <rect
                  x={MARGIN.left + slot * index}
                  y={MARGIN.top}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                />
              </g>
            );
          })}
        </svg>
      )}

      {hoveredDatum && (
        <div
          className="chart-tooltip"
          role="status"
          style={{
            left: Math.min(Math.max(tooltipLeft, 70), Math.max(70, width - 70)),
            top: Math.max(0, y(hoveredDatum.value) - 52),
          }}
        >
          <div className="chart-tooltip-label">{hoveredDatum.longLabel}</div>
          <div className="chart-tooltip-value">{formatValue(hoveredDatum.value)}</div>
        </div>
      )}
    </div>
  );
}
