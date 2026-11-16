import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin } from './auth/RequireAdmin';
import { AdminLayout } from './components/AdminLayout';
import { enc, Redirect } from './components/Redirect';
import { BookingDetailPage } from './pages/BookingDetailPage';
import { BookingsPage } from './pages/BookingsPage';
import { ComplaintDetailPage } from './pages/ComplaintDetailPage';
import { ComplaintsPage } from './pages/ComplaintsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DriverApplicationPage } from './pages/DriverApplicationPage';
import { DriverDetailPage } from './pages/DriverDetailPage';
import { DriversPage } from './pages/DriversPage';
import { DriverVerificationPage } from './pages/DriverVerificationPage';
import { EarningsIndexRedirect, EarningsPage } from './pages/EarningsPage';
import { PassengerDetailPage } from './pages/PassengerDetailPage';
import { PassengersPage } from './pages/PassengersPage';
import { ReportsPage } from './pages/ReportsPage';
import { LoginPage } from './pages/LoginPage';
import { DeletionRequestPage } from './pages/DeletionRequestPage';
import { DeletionRequestsPage } from './pages/DeletionRequestsPage';
import { LegalPage } from './pages/LegalPage';
import { OutOfAreaTripDetailPage } from './pages/OutOfAreaTripDetailPage';
import { OutOfAreaTripsPage } from './pages/OutOfAreaTripsPage';
import { ComplaintsLayout, DashboardLayout, DriversLayout, TripsLayout } from './pages/SectionLayouts';
import { SettingsLayout } from './pages/SettingsLayout';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Public: no sign-in needed (linked from the app stores, the app and the login page). */}
          <Route path="/privacy" element={<LegalPage document="privacy-notice" />} />
          <Route path="/terms" element={<LegalPage document="terms" />} />
          <Route
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            {/* Dashboard: Overview | Reports */}
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard/reports" element={<ReportsPage />} />
            </Route>
            <Route path="/dashboard" element={<Navigate to="/" replace />} />

            {/* Drivers: All drivers | Applications */}
            <Route path="/drivers" element={<DriversLayout />}>
              <Route index element={<Navigate to="all" replace />} />
              <Route path="applications" element={<DriverVerificationPage />} />
              <Route path="applications/:uid" element={<DriverApplicationPage />} />
              <Route path="all" element={<DriversPage />} />
              <Route path="all/:uid" element={<DriverDetailPage />} />
            </Route>

            <Route path="/passengers" element={<PassengersPage />} />
            <Route path="/passengers/:uid" element={<PassengerDetailPage />} />

            {/* Trips: Bookings | Out-of-area requests */}
            <Route path="/trips" element={<TripsLayout />}>
              <Route index element={<Navigate to="bookings" replace />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="bookings/:bookingId" element={<BookingDetailPage />} />
              <Route path="out-of-area" element={<OutOfAreaTripsPage />} />
              <Route path="out-of-area/:requestId" element={<OutOfAreaTripDetailPage />} />
            </Route>

            <Route path="/earnings" element={<EarningsIndexRedirect />} />
            <Route path="/earnings/:tab" element={<EarningsPage />} />

            {/* Complaints: Against drivers | Against passengers (by reporterRole) */}
            <Route path="/complaints" element={<ComplaintsLayout />}>
              <Route index element={<Redirect to="/complaints/against-drivers" />} />
              <Route path=":tab" element={<ComplaintsPage />} />
              <Route path=":tab/:complaintId" element={<ComplaintDetailPage />} />
            </Route>

            <Route path="/account-deletion" element={<DeletionRequestsPage />} />
            <Route path="/account-deletion/:uid" element={<DeletionRequestPage />} />

            {/* Settings: Fares | Barangay tariffs | Commission | Quota | System */}
            <Route path="/settings/:tab" element={<SettingsLayout />} />

            {/* Old URLs → new page/tab (query string, hash and state are kept). */}
            <Route path="/reports" element={<Redirect to="/dashboard/reports" />} />
            <Route path="/reports/complaints" element={<Redirect to="/complaints/against-drivers" />} />
            {/* The detail page moves the URL to the complaint's own tab once loaded. */}
            <Route
              path="/reports/complaints/:complaintId"
              element={<Redirect to={(p) => `/complaints/against-drivers/${enc(p.complaintId)}`} />}
            />
            {/* /drivers/:uid was a driver application; static tabs above take precedence. */}
            <Route path="/drivers/:uid" element={<Redirect to={(p) => `/drivers/applications/${enc(p.uid)}`} />} />
            <Route path="/driver-accounts" element={<Redirect to="/drivers/all" />} />
            <Route path="/driver-accounts/:uid" element={<Redirect to={(p) => `/drivers/all/${enc(p.uid)}`} />} />
            {/* Briefly a Passengers tab; static paths take precedence over /passengers/:uid. */}
            <Route path="/passengers/deletion-requests" element={<Redirect to="/account-deletion" />} />
            <Route
              path="/passengers/deletion-requests/:uid"
              element={<Redirect to={(p) => `/account-deletion/${enc(p.uid)}`} />}
            />
            <Route path="/out-of-area" element={<Redirect to="/trips/out-of-area" />} />
            <Route
              path="/out-of-area/:requestId"
              element={<Redirect to={(p) => `/trips/out-of-area/${enc(p.requestId)}`} />}
            />
            {/* /settings was System settings. */}
            <Route path="/settings" element={<Redirect to="/settings/system" />} />
            <Route path="/fares" element={<Redirect to="/settings/fares" />} />
            <Route path="/tariffs" element={<Redirect to="/settings/tariffs" />} />
            <Route path="/commission" element={<Redirect to="/settings/commission" />} />
            <Route path="/quota" element={<Redirect to="/settings/quota" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
