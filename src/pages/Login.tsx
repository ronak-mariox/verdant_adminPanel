import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Label } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';

export function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  // Already signed in (and session-restore has settled) — skip the login form.
  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[var(--shadow-button)]">
            <Leaf size={22} strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-ink-900">Verdant</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Admin Panel</p>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-surface p-6 shadow-[var(--shadow-card)]">
          <h1 className="font-display text-[17px] font-semibold text-ink-900">Sign in</h1>
          <p className="mt-1 text-[13px] text-ink-500">Enter your credentials to access the admin panel.</p>

          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger-surface px-4 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
              <p className="text-[13px] font-medium text-danger">{error}</p>
            </div>
          )}

          <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@verdant.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>

            <div>
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" className="mt-1 w-full" loading={submitting}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
