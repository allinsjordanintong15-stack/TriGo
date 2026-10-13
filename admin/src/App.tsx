import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { RequireAdmin } from './auth/RequireAdmin';
import { AdminLayout } from './components/AdminLayout';
import { BarangayTariffsPage } from './pages/BarangayTariffsPage';
import { CommissionPage } from './pages/CommissionPage';
import { DashboardPage } from './pages/DashboardPage';
import { DriverApplicationPage } from './pages/DriverApplicationPage';
import { DriverVerificationPage } from './pages/DriverVerificationPage';
import { FareSettingsPage } from './pages/FareSettingsPage';
import { LoginPage } from './pages/LoginPage';

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
            <Route path="/drivers" element={<DriverVerificationPage />} />
            <Route path="/drivers/:uid" element={<DriverApplicationPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
