import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { VEHICLE_TYPE_LABELS } from '../bookings/bookings';
import {
  DUTY_LABELS,
  dutyStatus,
  matchesDriverSearch,
  VERIFICATION_BADGE_CLASS,
  VERIFICATION_LABELS,
  verificationStatus,
  type VerificationStatus,
} from '../drivers/driverRecords';
import { loadDrivers, type DriverListEntry } from '../drivers/drivers';

type Filter = 'all' | VerificationStatus;

export function DriversPage() {
  const location = useLocation();
  const flash = (location.state as { message?: string } | null)?.message ?? null;
  const [entries, setEntries] = useState<DriverListEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setEntries(await loadDrivers());
    } catch {
      setLoadError('Could not load drivers. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = useMemo(
    () => (entries ?? []).map((entry) => ({ ...entry, verification: verificationStatus(entry.driver) })),
    [entries],
  );

  const counts = useMemo(() => {
    const result: Record<VerificationStatus, number> = { verified: 0, revoked: 0, unverified: 0 };
    for (const row of rows) result[row.verification] += 1;
    return result;
  }, [rows]);

  const filtered = rows.filter(
    (row) => (filter === 'all' || row.verification === filter) && matchesDriverSearch(row.driver, row.contact, search),
  );

  return (
    <div className="stack">
      {flash && (
        <div className="alert-success" role="status">
          {flash}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Drivers</h2>
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Every driver record. Open a driver to see their trips or to revoke or restore their verification. New
          applicants are reviewed under <Link to="/drivers">Driver verification</Link>.
        </p>
        <div className="filter-row">
          <label className="field search-field" htmlFor="driver-search">
            <span>Search by name, plate, email or mobile number</span>
            <input
              id="driver-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Carlo, ABC 1234, 0917…"
              autoComplete="off"
            />
          </label>
          <label className="field filter-field" htmlFor="driver-filter">
            <span>Show</span>
            <select id="driver-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">All drivers ({rows.length})</option>
              <option value="verified">Verified ({counts.verified})</option>
              <option value="revoked">Revoked ({counts.revoked})</option>
              <option value="unverified">Not verified ({counts.unverified})</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        {loadError ? (
          <div className="alert-error" role="alert">
            {loadError}
          </div>
        ) : !entries ? (
          <p className="muted">Loading drivers…</p>
        ) : (
          <>
            <p className="muted small" aria-live="polite">
              {filtered.length === rows.length ? `${rows.length} drivers.` : `${filtered.length} of ${rows.length} drivers match.`}
            </p>
            {filtered.length === 0 ? (
              <p className="muted">{rows.length === 0 ? 'No drivers yet.' : 'No drivers match.'}</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table drivers-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Vehicle</th>
                      <th scope="col">Mobile</th>
                      <th scope="col">Verification</th>
                      <th scope="col">Now</th>
                      <th scope="col">Rating</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(({ driver, contact, verification }) => (
                      <tr key={driver.uid}>
                        <td className="cell-strong">{driver.fullName || '(no name)'}</td>
                        <td>
                          <div className="mono">{driver.vehiclePlate || '—'}</div>
                          <div className="muted small">
                            {driver.vehicleType ? VEHICLE_TYPE_LABELS[driver.vehicleType] : 'Unknown type'}
                          </div>
                        </td>
                        <td className="mono">{contact?.mobileNumber || '—'}</td>
                        <td>
                          <span className={`status-badge ${VERIFICATION_BADGE_CLASS[verification]}`}>
                            {VERIFICATION_LABELS[verification]}
                          </span>
                        </td>
                        <td>{DUTY_LABELS[dutyStatus(driver)]}</td>
                        <td>{driver.rating ? driver.rating.toFixed(1) : '—'}</td>
                        <td className="cell-action">
                          <Link className="btn-link" to={`/driver-accounts/${driver.uid}`}>
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
