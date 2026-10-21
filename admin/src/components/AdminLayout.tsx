import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import logo from '../assets/logo.png';
import { useAuth } from '../auth/AuthContext';
import { useAdminCounts, type AdminCounts } from '../lib/adminCounts';
import { AdminCountsProvider } from './AdminCountsProvider';
import { NavIcon, type NavIconName } from './NavIcons';

type NavItem = {
  to: string;
  label: string;
  icon: NavIconName;
  end?: boolean;
  /** Sidebar badge: a count of work waiting, and how a screen reader names it. */
  badge?: { count: keyof AdminCounts; noun: [string, string] };
};

// Sidebar, grouped by importance. Add future admin pages here.
const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ to: '/', label: 'Dashboard', icon: 'dashboard', end: true }] },
  {
    label: 'Money',
    items: [
      {
        to: '/earnings',
        label: 'Earnings',
        icon: 'earnings',
        badge: { count: 'pendingPayments', noun: ['pending payment', 'pending payments'] },
      },
    ],
  },
  {
    label: 'Drivers',
    items: [
      {
        to: '/drivers',
        label: 'Driver verification',
        icon: 'verification',
        badge: { count: 'pendingApplications', noun: ['pending application', 'pending applications'] },
      },
      { to: '/driver-accounts', label: 'Drivers', icon: 'drivers' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/passengers', label: 'Passengers', icon: 'passengers' },
      { to: '/out-of-area', label: 'Out-of-area trips', icon: 'outOfArea' },
      {
        to: '/reports',
        label: 'Reports & Complaints',
        icon: 'reports',
        badge: { count: 'openComplaints', noun: ['open complaint', 'open complaints'] },
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/fares', label: 'Fare settings', icon: 'fares' },
      { to: '/tariffs', label: 'Barangay tariffs', icon: 'tariffs' },
      { to: '/commission', label: 'Commission', icon: 'commission' },
      { to: '/settings', label: 'System settings', icon: 'settings' },
    ],
  },
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
          <img src={logo} alt="TriGo logo" className="sidebar-logo" width={40} height={40} />
          <span className="sidebar-title">TriGo Admin</span>
        </div>

        <nav className="sidebar-nav" aria-label="Admin">
          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? 'top'} className="nav-group">
              {group.label && <div className="nav-group-label">{group.label}</div>}
              {group.items.map((item) => {
                const count = item.badge && counts ? counts[item.badge.count] : 0;
                const badgeText = item.badge
                  ? `, ${count} ${item.badge.noun[count === 1 ? 0 : 1]}`
                  : '';
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    aria-label={count > 0 ? `${item.label}${badgeText}` : undefined}
                  >
                    <NavIcon name={item.icon} />
                    <span className="nav-label">{item.label}</span>
                    {count > 0 && (
                      <span className="nav-badge" aria-hidden="true">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
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
