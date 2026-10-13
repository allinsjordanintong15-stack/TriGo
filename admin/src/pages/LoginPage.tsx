import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { admin, loading, error, signIn, clearError } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (admin) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    await signIn(email, password);
    setSubmitting(false);
  }

  const busy = submitting || loading;

  return (
    <div className="center-screen">
      <form className="card login-card" onSubmit={handleSubmit} noValidate>
        <h1 className="brand">TriGo</h1>
        <p className="muted">Admin sign in</p>

        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) clearError();
            }}
            disabled={busy}
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) clearError();
            }}
            disabled={busy}
            required
          />
        </label>

        <button type="submit" className="btn-primary" disabled={busy || !email.trim() || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
