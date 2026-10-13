import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';

/** Renders children only for a signed-in user with the `admin` claim; otherwise goes to /login. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="center-screen muted">Loading…</div>;
  }
  if (!admin) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
