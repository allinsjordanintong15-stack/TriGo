import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { defaultDateRange, parseDateRange } from '../lib/dateRange';
import { ColumnChart, type ColumnDatum } from '../reports/ColumnChart';
import { DEFAULT_REPORT_DAYS, MAX_REPORT_DAYS, roundPeso, toCsv } from '../reports/reportMath';
import { loadReport, type Report } from '../reports/reports';

const PRESETS = [7, 30, 90] as const;

function peso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;
}

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
}

function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [draft, setDraft] = useState(() => defaultDateRange(new Date(), DEFAULT_REPORT_DAYS));
  const [applied, setApplied] = useState(draft);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const range = parseDateRange(applied.from, applied.to, MAX_REPORT_DAYS);
    if ('error' in range) return; // apply() never applies an invalid range
    setLoadError(null);
    try {
      setReport(await loadReport(range));
    } catch {
      setLoadError('Could not load the report. Check your connection and reload the page.');
    }
  }, [applied]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function apply(next: { from: string; to: string }) {
    const range = parseDateRange(next.from, next.to, MAX_REPORT_DAYS);
    if ('error' in range) {
      setRangeError(range.error);
      return;
    }
    setRangeError(null);
    setReport(null);
    setDraft(next);
    setApplied({ ...next });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    apply(draft);
  }

  const rangeLabel = `${applied.from} to ${applied.to}`;
  const unit = report?.granularity === 'month' ? 'month' : 'day';

  const tripsData: ColumnDatum[] = (report?.rows ?? []).map((row) => ({
    key: row.period.isoStart,
    label: row.period.label,
    longLabel: row.period.longLabel,
    value: row.completedTrips,
  }));
  const faresData: ColumnDatum[] = (report?.rows ?? []).map((row) => ({
    key: row.period.isoStart,
    label: row.period.label,
    longLabel: row.period.longLabel,
    value: row.fares,
  }));

  const commission =
    report && report.commissionPercentage !== null
      ? roundPeso((report.totals.fares * report.commissionPercentage) / 100)
      : null;

  function exportPeriods() {
    if (!report) return;
    downloadCsv(`trigo-report-by-${unit}-${applied.from}-to-${applied.to}.csv`, [
      ['Period start', 'Period', 'Completed trips', 'Fares collected (PHP)', 'Cancelled bookings'],
      ...report.rows.map((row) => [
        row.period.isoStart,
        row.period.longLabel,
        row.completedTrips,
        row.fares.toFixed(2),
        row.cancelledBookings,
      ]),
      ['', 'Total', report.totals.completedTrips, report.totals.fares.toFixed(2), report.totals.cancelledBookings],
    ]);
  }

  function exportSummary() {
    if (!report) return;
    const { totals, byType } = report;
    downloadCsv(`trigo-report-summary-${applied.from}-to-${applied.to}.csv`, [
      ['Metric', 'Value'],
      ['From', applied.from],
      ['To', applied.to],
      ['Completed trips', totals.completedTrips],
      ['Fares collected (PHP)', totals.fares.toFixed(2)],
      ['Cancelled bookings', totals.cancelledBookings],
      ['Completed standard trips', byType.standard.trips],
      ['Standard fares (PHP)', byType.standard.fares.toFixed(2)],
      ['Completed out-of-area trips', byType.outOfArea.trips],
      ['Out-of-area fares (PHP)', byType.outOfArea.fares.toFixed(2)],
      ['Out-of-area requests', report.outOfAreaRequests],
      ['New passengers', report.newPassengers],
      ['Verified drivers (now)', report.verifiedDrivers],
      ['Commission rate (current, %)', report.commissionPercentage ?? 'Not set'],
      ['Commission at current rate (PHP, estimate)', commission !== null ? commission.toFixed(2) : 'Not set'],
    ]);
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <h2>Reports</h2>
          <button type="button" className="btn-outline" onClick={() => void reload()} disabled={!report && !loadError}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Trips and fares for a date range. A trip counts on the day it was completed or cancelled. Totals are counted
          by Firestore, so no trip records are downloaded.
        </p>
        <form className="date-range-form" onSubmit={handleSubmit} noValidate>
          <label className="field" htmlFor="report-from">
            <span>From</span>
            <input
              id="report-from"
              type="date"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => setDraft((range) => ({ ...range, from: e.target.value }))}
            />
          </label>
          <label className="field" htmlFor="report-to">
            <span>to</span>
            <input
              id="report-to"
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => setDraft((range) => ({ ...range, to: e.target.value }))}
            />
          </label>
          <button type="submit" className="btn-primary">
            Show
          </button>
          <div className="preset-group" role="group" aria-label="Quick ranges">
            {PRESETS.map((days) => (
              <button key={days} type="button" className="btn-outline" onClick={() => apply(defaultDateRange(new Date(), days))}>
                Last {days} days
              </button>
            ))}
          </div>
        </form>
        {rangeError && (
          <div className="alert-error" role="alert">
            {rangeError}
          </div>
        )}
      </div>

      {loadError ? (
        <div className="alert-error" role="alert">
          {loadError}
        </div>
      ) : !report ? (
        <div className="card muted">Loading report…</div>
      ) : (
        <>
          <div className="stat-grid">
            <Stat label="Completed trips" value={report.totals.completedTrips.toLocaleString()} />
            <Stat label="Fares collected" value={peso(report.totals.fares)} />
            <Stat
              label={
                report.commissionPercentage !== null
                  ? `Commission at ${report.commissionPercentage}% (estimate)`
                  : 'Commission (rate not set)'
              }
              value={commission !== null ? peso(commission) : '—'}
            />
            <Stat label="Cancelled bookings" value={report.totals.cancelledBookings.toLocaleString()} />
            <Stat
              label="Completion rate"
              value={percent(report.totals.completedTrips, report.totals.completedTrips + report.totals.cancelledBookings)}
            />
            <Stat label="Out-of-area requests" value={report.outOfAreaRequests.toLocaleString()} />
            <Stat label="New passengers" value={report.newPassengers.toLocaleString()} />
            <Stat label="Verified drivers (now)" value={report.verifiedDrivers.toLocaleString()} />
          </div>

          <div className="chart-grid">
            <section className="card" aria-labelledby="trips-chart-title">
              <h3 id="trips-chart-title">Completed trips per {unit}</h3>
              <ColumnChart
                data={tripsData}
                integer
                formatValue={(value) => plural(value, 'trip')}
                ariaLabel={`Completed trips per ${unit}, ${rangeLabel}. ${report.totals.completedTrips} in total.`}
              />
            </section>
            <section className="card" aria-labelledby="fares-chart-title">
              <h3 id="fares-chart-title">Fares collected per {unit}</h3>
              <ColumnChart
                data={faresData}
                integer={false}
                formatValue={peso}
                ariaLabel={`Fares collected per ${unit}, ${rangeLabel}. ${peso(report.totals.fares)} in total.`}
              />
            </section>
          </div>

          <div className="card">
            <h3>Completed trips by type</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col" className="num">Trips</th>
                    <th scope="col" className="num">Share</th>
                    <th scope="col" className="num">Fares</th>
                  </tr>
                </thead>
                <tbody>
                  <TypeRowView label="Standard" row={report.byType.standard} total={report.totals.completedTrips} />
                  <TypeRowView label="Out-of-area" row={report.byType.outOfArea} total={report.totals.completedTrips} />
                </tbody>
              </table>
            </div>
            {report.commissionPercentage !== null && (
              <p className="muted small">
                Commission is estimated at the current rate on all completed fares. Nothing is charged to drivers yet.
              </p>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Export</h3>
            </div>
            <p className="muted small">CSV files open in Excel or Google Sheets. Amounts are in pesos.</p>
            <div className="button-row">
              <button type="button" className="btn-outline" onClick={exportPeriods}>
                Download per-{unit} CSV
              </button>
              <button type="button" className="btn-outline" onClick={exportSummary}>
                Download summary CSV
              </button>
            </div>
            <details className="report-table">
              <summary>Show the numbers as a table</summary>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">{unit === 'day' ? 'Day' : 'Month'}</th>
                      <th scope="col" className="num">Completed trips</th>
                      <th scope="col" className="num">Fares collected</th>
                      <th scope="col" className="num">Cancelled bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.period.isoStart}>
                        <td>{row.period.longLabel}</td>
                        <td className="num">{row.completedTrips}</td>
                        <td className="num">{peso(row.fares)}</td>
                        <td className="num">{row.cancelledBookings}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td>Total</td>
                      <td className="num">{report.totals.completedTrips}</td>
                      <td className="num">{peso(report.totals.fares)}</td>
                      <td className="num">{report.totals.cancelledBookings}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}

function TypeRowView({ label, row, total }: { label: string; row: { trips: number; fares: number }; total: number }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="num">{row.trips.toLocaleString()}</td>
      <td className="num">{percent(row.trips, total)}</td>
      <td className="num">{peso(row.fares)}</td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
