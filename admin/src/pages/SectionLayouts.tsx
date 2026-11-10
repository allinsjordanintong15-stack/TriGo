import { Outlet } from 'react-router-dom';

import { PageTabs, type PageTab } from '../components/PageTabs';

// Sidebar sections with tabs. Each tab is a URL (detail pages live under their tab), so links,
// refresh and back/forward all work. Old URLs redirect here (see App.tsx).

const DRIVER_TABS: PageTab[] = [
  {
    to: '/drivers/applications',
    label: 'Applications',
    badge: { count: 'pendingApplications', noun: ['pending application', 'pending applications'] },
  },
  { to: '/drivers/all', label: 'All drivers' },
];

export function DriversLayout() {
  return (
    <div className="stack">
      <PageTabs label="Drivers" tabs={DRIVER_TABS} />
      <Outlet />
    </div>
  );
}

// One tab for now, so no tab bar is shown. To add "All bookings": add its route under /trips in
// App.tsx and a second entry here; the tab bar then appears.
const TRIP_TABS: PageTab[] = [{ to: '/trips/out-of-area', label: 'Out-of-area trips' }];

export function TripsLayout() {
  return (
    <div className="stack">
      <PageTabs label="Trips" tabs={TRIP_TABS} />
      <Outlet />
    </div>
  );
}
