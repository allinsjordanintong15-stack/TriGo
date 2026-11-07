import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin } from './auth/RequireAdmin';
import { AdminLayout } from './components/AdminLayout';
import { BarangayTariffsPage } from './pages/BarangayTariffsPage';
import { CommissionPage } from './pages/CommissionPage';
import { ComplaintDetailPage } from './pages/ComplaintDetailPage';
import { ComplaintsPage } from './pages/ComplaintsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DriverApplicationPage } from './pages/DriverApplicationPage';
import { DriverDetailPage } from './pages/DriverDetailPage';
import { DriversPage } from './pages/DriversPage';
import { DriverVerificationPage } from './pages/DriverVerificationPage';
import { EarningsPage } from './pages/EarningsPage';
import { FareSettingsPage } from './pages/FareSettingsPage';
import { PassengerDetailPage } from './pages/PassengerDetailPage';
import { PassengersPage } from './pages/PassengersPage';
import { QuotaPage } from './pages/QuotaPage';
import { ReportsLayout } from './pages/ReportsLayout';
import { ReportsPage } from './pages/ReportsPage';
import { SystemSettingsPage } from './pages/SystemSettingsPage';
import { LoginPage } from './pages/LoginPage';
import { DeletionRequestPage } from './pages/DeletionRequestPage';
import { DeletionRequestsPage } from './pages/DeletionRequestsPage';
import { LegalPage } from './pages/LegalPage';
import { OutOfAreaTripDetailPage } from './pages/OutOfAreaTripDetailPage';
import { OutOfAreaTripsPage } from './pages/OutOfAreaTripsPage';

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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/reports" element={<ReportsLayout />}>
              <Route index element={<ReportsPage />} />
              <Route path="complaints" element={<ComplaintsPage />} />
              <Route path="complaints/:complaintId" element={<ComplaintDetailPage />} />
            </Route>
            <Route path="/fares" element={<FareSettingsPage />} />
            <Route path="/tariffs" element={<BarangayTariffsPage />} />
            <Route path="/commission" element={<CommissionPage />} />
            <Route path="/earnings" element={<EarningsPage />} />
            <Route path="/settings" element={<SystemSettingsPage />} />
            <Route path="/passengers" element={<PassengersPage />} />
            <Route path="/passengers/:uid" element={<PassengerDetailPage />} />
            <Route path="/out-of-area" element={<OutOfAreaTripsPage />} />
            <Route path="/out-of-area/:requestId" element={<OutOfAreaTripDetailPage />} />
            <Route path="/driver-accounts" element={<DriversPage />} />
            <Route path="/driver-accounts/:uid" element={<DriverDetailPage />} />
            <Route path="/drivers" element={<DriverVerificationPage />} />
            <Route path="/drivers/:uid" element={<DriverApplicationPage />} />
            <Route path="/quota" element={<QuotaPage />} />
            <Route path="/account-deletion" element={<DeletionRequestsPage />} />
            <Route path="/account-deletion/:uid" element={<DeletionRequestPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
