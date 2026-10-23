import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import logo from '../assets/logo.png';
import { useAuth } from '../auth/AuthContext';
import { PasswordInput } from '../components/PasswordInput';

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
        <div className="login-header">
          <img src={logo} alt="TriGo logo" className="login-logo" width={96} height={96} />
          <h1 className="brand">TriGo Admin</h1>
          <p className="muted">Sign in with your admin account</p>
        </div>

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

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) clearError();
            }}
            disabled={busy}
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={busy || !email.trim() || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
