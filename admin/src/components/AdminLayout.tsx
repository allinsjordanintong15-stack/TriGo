import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

export function AdminLayout() {
  const { admin, signOutAdmin } = useAuth();

  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">TriGo Admin</span>
        <div className="topbar-right">
          <span className="muted-light">{admin?.email}</span>
          <button type="button" className="btn-secondary" onClick={() => void signOutAdmin()}>
            Sign out
          </button>
        </div>
      </header>
      <nav className="nav">
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/fares">Fare settings</NavLink>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
