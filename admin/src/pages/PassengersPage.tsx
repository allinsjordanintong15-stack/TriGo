import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDate } from '../bookings/bookings';
import { loadPassengers, matchesSearch, type Passenger } from '../passengers/passengers';

export function PassengersPage() {
  const [passengers, setPassengers] = useState<Passenger[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setPassengers(await loadPassengers());
    } catch {
      setLoadError('Could not load passengers. Check your connection and reload the page.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(
    () => (passengers ?? []).filter((passenger) => matchesSearch(passenger, search)),
    [passengers, search],
  );

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <h2>Passengers</h2>
          <button type="button" className="btn-outline" onClick={() => void reload()}>
            Refresh
          </button>
        </div>
        <p className="muted">Passenger accounts and their booking history. Read-only.</p>
        <label className="field search-field" htmlFor="passenger-search">
          <span>Search by name, email or mobile number</span>
          <input
            id="passenger-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Juan, juan@…, 0917…"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="card">
        {loadError ? (
          <div className="alert-error" role="alert">
            {loadError}
          </div>
        ) : !passengers ? (
          <p className="muted">Loading passengers…</p>
        ) : (
          <>
            <p className="muted small" aria-live="polite">
              {search.trim()
                ? `${filtered.length} of ${passengers.length} passengers match.`
                : `${passengers.length} passengers.`}
            </p>
            {filtered.length === 0 ? (
              <p className="muted">{passengers.length === 0 ? 'No passengers yet.' : 'No passengers match your search.'}</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Mobile</th>
                      <th scope="col">Joined</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((passenger) => (
                      <tr key={passenger.uid}>
                        <td className="cell-strong">{passenger.fullName || '(no name)'}</td>
                        <td>{passenger.email}</td>
                        <td className="mono">{passenger.mobileNumber}</td>
                        <td>{formatDate(passenger.createdAt)}</td>
                        <td className="cell-action">
                          <Link className="btn-link" to={`/passengers/${passenger.uid}`}>
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
