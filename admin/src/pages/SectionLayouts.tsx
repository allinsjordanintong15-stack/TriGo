import { Outlet } from 'react-router-dom';

import { PageTabs, type PageTab } from '../components/PageTabs';

// Sidebar sections with tabs. Each tab is a URL (detail pages live under their tab), so links,
// refresh and back/forward all work. Old URLs redirect here (see App.tsx).

const DRIVER_TABS: PageTab[] = [
  { to: '/drivers/all', label: 'All drivers' },
  {
    to: '/drivers/applications',
    label: 'Applications',
    badge: { count: 'pendingApplications', noun: ['pending application', 'pending applications'] },
  },
];

export function DriversLayout() {
  return (
    <div className="stack">
      <PageTabs label="Drivers" tabs={DRIVER_TABS} />
      <Outlet />
    </div>
  );
}

// Dashboard: Overview (/) | Reports (/dashboard/reports).
const DASHBOARD_TABS: PageTab[] = [
  { to: '/', label: 'Overview', match: (pathname) => pathname === '/' },
  { to: '/dashboard/reports', label: 'Reports' },
];

export function DashboardLayout() {
  return (
    <div className="stack">
      <PageTabs label="Dashboard" tabs={DASHBOARD_TABS} />
      <Outlet />
    </div>
  );
}

// Complaints by who reported (see COMPLAINT_TABS); detail pages live under their tab.
const COMPLAINT_TABS: PageTab[] = [
  {
    to: '/complaints/against-drivers',
    label: 'Against drivers',
    badge: { count: 'openComplaintsAgainstDrivers', noun: ['open complaint', 'open complaints'] },
  },
  {
    to: '/complaints/against-passengers',
    label: 'Against passengers',
    badge: { count: 'openComplaintsAgainstPassengers', noun: ['open complaint', 'open complaints'] },
  },
];

export function ComplaintsLayout() {
  return (
    <div className="stack">
      <PageTabs label="Complaints" tabs={COMPLAINT_TABS} />
      <Outlet />
    </div>
  );
}

// One tab for now, so no tab bar is shown. To add "All bookings": add its route under /trips in
// App.tsx and a second entry here; the tab bar then appears.
const TRIP_TABS: PageTab[] = [
  { to: '/trips/bookings', label: 'Bookings' },
  { to: '/trips/out-of-area', label: 'Out-of-area requests' },
];

export function TripsLayout() {
  return (
    <div className="stack">
      <PageTabs label="Trips" tabs={TRIP_TABS} />
      <Outlet />
    </div>
  );
}
