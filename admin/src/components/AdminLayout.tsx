import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import logo from '../assets/logo.png';
import { useAuth } from '../auth/AuthContext';
import { useAdminCounts, type AdminCounts } from '../lib/adminCounts';
import { AdminCountsProvider } from './AdminCountsProvider';
import { LegalLinks } from './LegalLinks';
import { isUnder } from './PageTabs';
import { NavIcon, type NavIconName } from './NavIcons';

type NavItem = {
  to: string;
  label: string;
  icon: NavIconName;
  /** Path prefix that marks the item active (its tabs and detail pages); exact match if omitted. */
  section?: string;
  /** Sidebar badge: a count of work waiting, and how a screen reader names it. */
  badge?: { count: keyof AdminCounts; noun: [string, string] };
};

// Sidebar. Sections with tabs link to their first tab; their tabs live in the URL (see App.tsx).
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', section: '/dashboard' },
  {
    to: '/drivers/all',
    label: 'Drivers',
    icon: 'drivers',
    section: '/drivers',
    badge: { count: 'pendingApplications', noun: ['pending application', 'pending applications'] },
  },
  { to: '/passengers', label: 'Passengers', icon: 'passengers', section: '/passengers' },
  { to: '/trips/out-of-area', label: 'Trips', icon: 'outOfArea', section: '/trips' },
  {
    to: '/earnings',
    label: 'Earnings',
    icon: 'earnings',
    section: '/earnings',
    badge: { count: 'pendingPayments', noun: ['pending payment', 'pending payments'] },
  },
  {
    to: '/complaints/against-drivers',
    label: 'Complaints',
    icon: 'reports',
    section: '/complaints',
    badge: { count: 'openComplaints', noun: ['open complaint', 'open complaints'] },
  },
  {
    to: '/account-deletion',
    label: 'Account deletion',
    icon: 'privacy',
    section: '/account-deletion',
    badge: { count: 'pendingDeletions', noun: ['pending deletion request', 'pending deletion requests'] },
  },
  { to: '/settings/fares', label: 'Settings', icon: 'settings', section: '/settings' },
];

export function AdminLayout() {
  return (
    <AdminCountsProvider>
      <Shell />
    </AdminCountsProvider>
  );
}

function Shell() {
  const { admin, signOutAdmin } = useAuth();
  const { counts } = useAdminCounts();
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
          <img src={logo} alt="TriGo logo" className="sidebar-logo" width={32} height={32} />
          <span className="sidebar-title">TriGo Admin</span>
        </div>

        <nav className="sidebar-nav" aria-label="Admin">
          <div className="nav-group">
          {NAV_ITEMS.map((item) => {
            const active =
              location.pathname === item.to || (item.section ? isUnder(location.pathname, item.section) : false);
            const count = item.badge && counts ? counts[item.badge.count] : 0;
            const badgeText = item.badge ? `, ${count} ${item.badge.noun[count === 1 ? 0 : 1]}` : '';
            return (
              <Link
                key={item.to}
                to={item.to}
                className={active ? 'active' : undefined}
                aria-current={active ? 'page' : undefined}
                aria-label={count > 0 ? `${item.label}${badgeText}` : undefined}
              >
                <NavIcon name={item.icon} />
                <span className="nav-label">{item.label}</span>
                {count > 0 && (
                  <span className="nav-badge" aria-hidden="true">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            );
          })}
          </div>
        </nav>

        <LegalLinks className="sidebar-legal" newTab />

        {/* One row: the initial (full email on hover and for screen readers) and Sign out. */}
        <div className="sidebar-account">
          <span className="account-avatar" title={admin?.email ?? undefined} aria-hidden="true">
            {(admin?.email?.[0] ?? '?').toUpperCase()}
          </span>
          <span className="account-email" title={admin?.email ?? undefined}>
            {admin?.email}
          </span>
          <button type="button" className="btn-secondary btn-compact" onClick={() => void signOutAdmin()}>
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
