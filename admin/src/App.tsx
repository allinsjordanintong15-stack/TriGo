import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin } from './auth/RequireAdmin';
import { AdminLayout } from './components/AdminLayout';
import { BarangayTariffsPage } from './pages/BarangayTariffsPage';
import { CommissionPage } from './pages/CommissionPage';
import { DashboardPage } from './pages/DashboardPage';
import { DriverApplicationPage } from './pages/DriverApplicationPage';
import { DriverDetailPage } from './pages/DriverDetailPage';
import { DriversPage } from './pages/DriversPage';
import { DriverVerificationPage } from './pages/DriverVerificationPage';
import { FareSettingsPage } from './pages/FareSettingsPage';
import { PassengerDetailPage } from './pages/PassengerDetailPage';
import { PassengersPage } from './pages/PassengersPage';
import { LoginPage } from './pages/LoginPage';
import { OutOfAreaTripDetailPage } from './pages/OutOfAreaTripDetailPage';
import { OutOfAreaTripsPage } from './pages/OutOfAreaTripsPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/fares" element={<FareSettingsPage />} />
            <Route path="/tariffs" element={<BarangayTariffsPage />} />
            <Route path="/commission" element={<CommissionPage />} />
            <Route path="/passengers" element={<PassengersPage />} />
            <Route path="/passengers/:uid" element={<PassengerDetailPage />} />
            <Route path="/out-of-area" element={<OutOfAreaTripsPage />} />
            <Route path="/out-of-area/:requestId" element={<OutOfAreaTripDetailPage />} />
            <Route path="/driver-accounts" element={<DriversPage />} />
            <Route path="/driver-accounts/:uid" element={<DriverDetailPage />} />
            <Route path="/drivers" element={<DriverVerificationPage />} />
            <Route path="/drivers/:uid" element={<DriverApplicationPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
