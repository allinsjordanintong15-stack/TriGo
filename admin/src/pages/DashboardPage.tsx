import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
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
      <main className="content">
        <div className="card">
          <h2>Dashboard</h2>
          <p className="muted">Signed in as an admin. Management pages come in the next steps.</p>
        </div>
      </main>
    </div>
  );
}
