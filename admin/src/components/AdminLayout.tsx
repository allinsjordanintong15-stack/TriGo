import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import logo from '../assets/logo.png';
import { useAuth } from '../auth/AuthContext';

// Sidebar links. Add future admin pages here.
const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/fares', label: 'Fare settings' },
];

export function AdminLayout() {
  const { admin, signOutAdmin } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the narrow-screen menu after navigating.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  return (
    <div className={`shell${menuOpen ? ' menu-open' : ''}`}>
      {/* Shown below 768px only. */}
      <header className="mobile-bar">
        <button
          type="button"
          className="menu-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar"
        >
          <MenuIcon />
        </button>
        <img src={logo} alt="" className="mobile-bar-logo" width={32} height={32} />
        <span className="sidebar-title">TriGo Admin</span>
      </header>

      <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <aside id="admin-sidebar" className="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="TriGo logo" className="sidebar-logo" width={40} height={40} />
          <span className="sidebar-title">TriGo Admin</span>
        </div>

        <nav className="sidebar-nav" aria-label="Admin">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-email" title={admin?.email ?? undefined}>
            {admin?.email}
          </span>
          <button type="button" className="btn-secondary" onClick={() => void signOutAdmin()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true" focusable="false">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
