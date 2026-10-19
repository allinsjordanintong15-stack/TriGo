import { NavLink, Outlet } from 'react-router-dom';

// "Reports & Complaints": the tab is the URL (/reports = Analytics, /reports/complaints and
// /reports/complaints/:id = Complaints), so refresh, back and old /reports links all work.
export function ReportsLayout() {
  return (
    <div className="stack">
      <nav className="page-tabs" aria-label="Reports & Complaints">
        <NavLink to="/reports" end>
          Analytics
        </NavLink>
        <NavLink to="/reports/complaints">Complaints</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
