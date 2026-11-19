/// <reference types="node" />

// Admin website routes (admin/src/routes.tsx): every page, tab URL and old-URL redirect
// resolves as it did under <BrowserRouter><Routes>, now that the tree runs under the data
// router's catch-all route. Loads the real route list through Vite's module runner (JSX,
// import.meta.env), then follows each URL the way <Navigate>/<Redirect> would.
// Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

type RouteObject = { path?: string; index?: boolean; element?: unknown; children?: RouteObject[] };
type RouteMatch = { params: Record<string, string | undefined>; pathnameBase: string; route: RouteObject };
type Element = { type: unknown; props: Record<string, unknown> };

const ADMIN_DIR = fileURLToPath(new URL('../../admin/', import.meta.url));

// The route modules read the Firebase web config at import time (Vite's module runner does
// not load admin/.env files); placeholders are enough, nothing connects.
const PLACEHOLDER_ENV: Record<string, string> = {
  VITE_FIREBASE_API_KEY: 'test',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-trigo-routes.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-trigo-routes',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-trigo-routes.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
  VITE_FIREBASE_APP_ID: 'test',
};

let routes: RouteObject[];
let matchRoutes: (routes: RouteObject[], location: string) => RouteMatch[] | null;
let resolvePath: (to: string, from: string) => { pathname: string };

before(async () => {
  const vite = await import(pathToFileURL(`${ADMIN_DIR}node_modules/vite/dist/node/index.js`).href);
  const routesModule = await vite.runnerImport(`${ADMIN_DIR}src/routes.tsx`, {
    root: ADMIN_DIR,
    configFile: `${ADMIN_DIR}vite.config.ts`,
    logLevel: 'silent',
    define: Object.fromEntries(
      Object.entries(PLACEHOLDER_ENV).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
  });
  routes = routesModule.module.APP_ROUTES;
  const router = await import(pathToFileURL(`${ADMIN_DIR}node_modules/react-router/dist/development/index.mjs`).href);
  matchRoutes = router.matchRoutes;
  resolvePath = router.resolvePath;
});

function typeName(element: Element): string {
  const type = element.type as { name?: string; displayName?: string } | string;
  return typeof type === 'string' ? type : (type.displayName ?? type.name ?? '?');
}

/** The page a URL ends on: follows <Navigate> and <Redirect> like the router does. */
function resolve(url: string): { url: string; page: string; params: Record<string, string | undefined> } {
  let current = new URL(url, 'http://admin.test');
  for (let hops = 0; hops < 5; hops += 1) {
    const matches = matchRoutes(routes, current.pathname);
    assert.ok(matches, `no route for ${current.pathname}`);
    const leaf = matches[matches.length - 1];
    const element = leaf.route.element as Element;
    const name = typeName(element);
    let target: string | null = null;
    if (name === 'Navigate') {
      // <Navigate to> resolves relative to its route; it drops the query string and hash.
      target = resolvePath(element.props.to as string, leaf.pathnameBase).pathname;
    } else if (name === 'Redirect') {
      // <Redirect> (components/Redirect.tsx) keeps the query string and hash.
      const to = element.props.to as string | ((params: Record<string, string | undefined>) => string);
      target = `${typeof to === 'string' ? to : to(leaf.params)}${current.search}${current.hash}`;
    }
    if (target === null) {
      return { url: `${current.pathname}${current.search}${current.hash}`, page: name, params: leaf.params };
    }
    current = new URL(target, 'http://admin.test');
  }
  throw new Error(`redirect loop from ${url}`);
}

// [URL typed or linked, where it ends, the page/layout element rendered there]
const CASES: [string, string, string][] = [
  // Public
  ['/login', '/login', 'LoginPage'],
  ['/privacy', '/privacy', 'LegalPage'],
  ['/terms', '/terms', 'LegalPage'],
  // Dashboard: Overview | Reports
  ['/', '/', 'DashboardPage'],
  ['/dashboard', '/', 'DashboardPage'],
  ['/dashboard/reports', '/dashboard/reports', 'ReportsPage'],
  // Drivers: All drivers | Applications
  ['/drivers', '/drivers/all', 'DriversPage'],
  ['/drivers/all', '/drivers/all', 'DriversPage'],
  ['/drivers/all/u1', '/drivers/all/u1', 'DriverDetailPage'],
  ['/drivers/applications', '/drivers/applications', 'DriverVerificationPage'],
  ['/drivers/applications/u1', '/drivers/applications/u1', 'DriverApplicationPage'],
  // Passengers and account deletion
  ['/passengers', '/passengers', 'PassengersPage'],
  ['/passengers/u1', '/passengers/u1', 'PassengerDetailPage'],
  ['/announcements', '/announcements', 'AnnouncementsPage'],
  ['/account-deletion', '/account-deletion', 'DeletionRequestsPage'],
  ['/account-deletion/u1', '/account-deletion/u1', 'DeletionRequestPage'],
  // Trips: Bookings | Out-of-area
  ['/trips', '/trips/bookings', 'BookingsPage'],
  ['/trips/bookings', '/trips/bookings', 'BookingsPage'],
  ['/trips/bookings/b1', '/trips/bookings/b1', 'BookingDetailPage'],
  ['/trips/out-of-area', '/trips/out-of-area', 'OutOfAreaTripsPage'],
  ['/trips/out-of-area/r1', '/trips/out-of-area/r1', 'OutOfAreaTripDetailPage'],
  // Earnings tabs (EarningsPage reads :tab)
  ['/earnings', '/earnings', 'EarningsIndexRedirect'],
  ['/earnings/overview', '/earnings/overview', 'EarningsPage'],
  ['/earnings/payments', '/earnings/payments', 'EarningsPage'],
  ['/earnings/balances', '/earnings/balances', 'EarningsPage'],
  ['/earnings/cash-outs', '/earnings/cash-outs', 'EarningsPage'],
  // Complaints
  ['/complaints', '/complaints/against-drivers', 'ComplaintsPage'],
  ['/complaints/against-drivers', '/complaints/against-drivers', 'ComplaintsPage'],
  ['/complaints/against-passengers', '/complaints/against-passengers', 'ComplaintsPage'],
  ['/complaints/against-drivers/c1', '/complaints/against-drivers/c1', 'ComplaintDetailPage'],
  // Settings tabs (SettingsLayout reads :tab)
  ['/settings/fares', '/settings/fares', 'SettingsLayout'],
  ['/settings/tariffs', '/settings/tariffs', 'SettingsLayout'],
  ['/settings/commission', '/settings/commission', 'SettingsLayout'],
  ['/settings/quota', '/settings/quota', 'SettingsLayout'],
  ['/settings/system', '/settings/system', 'SettingsLayout'],
  // Old URLs
  ['/settings', '/settings/system', 'SettingsLayout'],
  ['/fares', '/settings/fares', 'SettingsLayout'],
  ['/tariffs', '/settings/tariffs', 'SettingsLayout'],
  ['/commission', '/settings/commission', 'SettingsLayout'],
  ['/quota', '/settings/quota', 'SettingsLayout'],
  ['/reports', '/dashboard/reports', 'ReportsPage'],
  ['/reports/complaints', '/complaints/against-drivers', 'ComplaintsPage'],
  ['/reports/complaints/c1', '/complaints/against-drivers/c1', 'ComplaintDetailPage'],
  ['/drivers/u1', '/drivers/applications/u1', 'DriverApplicationPage'],
  ['/driver-accounts', '/drivers/all', 'DriversPage'],
  ['/driver-accounts/u1', '/drivers/all/u1', 'DriverDetailPage'],
  ['/passengers/deletion-requests', '/account-deletion', 'DeletionRequestsPage'],
  ['/passengers/deletion-requests/u1', '/account-deletion/u1', 'DeletionRequestPage'],
  ['/out-of-area', '/trips/out-of-area', 'OutOfAreaTripsPage'],
  ['/out-of-area/r1', '/trips/out-of-area/r1', 'OutOfAreaTripDetailPage'],
  // Unknown
  ['/no-such-page', '/', 'DashboardPage'],
];

describe('admin routes', () => {
  for (const [from, to, page] of CASES) {
    it(`${from} → ${to} (${page})`, () => {
      const result = resolve(from);
      assert.equal(result.url, to);
      assert.equal(result.page, page);
    });
  }

  it('passes the tab param to the Settings layout', () => {
    assert.equal(resolve('/fares').params.tab, 'fares');
    assert.equal(resolve('/settings').params.tab, 'system');
  });

  it('old-URL redirects keep the query string and hash', () => {
    assert.equal(resolve('/fares?x=1#top').url, '/settings/fares?x=1#top');
    assert.equal(resolve('/driver-accounts/u%201?tab=a').url, '/drivers/all/u%201?tab=a');
    assert.equal(resolve('/reports/complaints/c1#m').url, '/complaints/against-drivers/c1#m');
  });

  it('encodes IDs in old-URL redirects', () => {
    assert.equal(resolve('/out-of-area/a%2Fb').url, '/trips/out-of-area/a%2Fb');
  });
});
