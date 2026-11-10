import { Navigate, useLocation, useParams, type Params } from 'react-router-dom';

/**
 * Old-URL redirect: maps the matched params to the new path and keeps the query string,
 * hash and navigation state (e.g. /driver-accounts/:uid → /drivers/all/:uid).
 */
export function Redirect({ to }: { to: string | ((params: Params) => string) }) {
  const params = useParams();
  const location = useLocation();
  const path = typeof to === 'string' ? to : to(params);
  return <Navigate to={`${path}${location.search}${location.hash}`} state={location.state} replace />;
}

export function enc(value: string | undefined): string {
  return encodeURIComponent(value ?? '');
}
