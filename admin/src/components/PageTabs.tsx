import { Link, useLocation } from 'react-router-dom';

import { useAdminCounts, type AdminCounts } from '../lib/adminCounts';

export type PageTab = {
  /** Where the tab goes. */
  to: string;
  label: string;
  /** Path prefixes that mark this tab active (defaults to `to`). Detail pages stay under their tab. */
  match?: (pathname: string) => boolean;
  /** Count badge from the shared sidebar counts (no extra queries); hidden when 0. */
  badge?: { count: keyof AdminCounts; noun: [string, string] };
};

export function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function activeTab<T extends PageTab>(tabs: T[], pathname: string): T | undefined {
  return tabs.find((tab) => (tab.match ? tab.match(pathname) : isUnder(pathname, tab.to)));
}

/**
 * Tab bar for a sidebar section. The tab is the URL, so links, refresh and back/forward work.
 * Renders nothing for a single tab (a section can grow tabs later without changing its routes).
 */
export function PageTabs({ label, tabs }: { label: string; tabs: PageTab[] }) {
  const { pathname } = useLocation();
  const { counts } = useAdminCounts();
  if (tabs.length < 2) return null;
  const active = activeTab(tabs, pathname);

  return (
    <nav className="page-tabs" aria-label={label}>
      {tabs.map((tab) => {
        const isActive = tab === active;
        const count = tab.badge && counts ? counts[tab.badge.count] : 0;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={isActive ? 'active' : undefined}
            aria-current={isActive ? 'page' : undefined}
            aria-label={count > 0 && tab.badge ? `${tab.label}, ${count} ${tab.badge.noun[count === 1 ? 0 : 1]}` : undefined}
          >
            {tab.label}
            {count > 0 && (
              <span className="nav-badge tab-badge" aria-hidden="true">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
