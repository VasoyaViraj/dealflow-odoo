import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleHome } from '../lib/auth';
import { AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { DealFlowMark } from '../components/layout/AppShell';

/* Each demo persona gets one of the signature card surfaces, so the row reads
   as the same brand palette the marketing site uses rather than five accents. */
const QUICK_LOGINS = [
  { label: 'Admin',    email: 'admin@dealflow.com',    role: 'ADMIN',                surface: 'bg-ink text-white' },
  { label: 'Sales',    email: 'sales@dealflow.com',    role: 'SALES_REPRESENTATIVE', surface: 'bg-peach text-ink' },
  { label: 'Manager',  email: 'manager@dealflow.com',  role: 'SALES_MANAGER',        surface: 'bg-mint text-forest' },
  { label: 'Finance',  email: 'finance@dealflow.com',  role: 'FINANCE_OPERATIONS',   surface: 'bg-cream text-ink' },
  { label: 'Customer', email: 'customer@dealflow.com', role: 'CUSTOMER',             surface: 'bg-strong text-ink' },
];

export default function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  // Already logged in — redirect
  if (user) return <Navigate to={getRoleHome(user.role)} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      // user state will update → redirect handled by effect
      const stored = localStorage.getItem('df_user');
      if (stored) {
        const u = JSON.parse(stored);
        navigate(getRoleHome(u.role), { replace: true });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Login failed. Check credentials.');
    }
  };

  const quickLogin = async (qEmail: string) => {
    setEmail(qEmail);
    setPassword('Password@123');
    setError('');
    try {
      await login(qEmail, 'Password@123');
      const stored = localStorage.getItem('df_user');
      if (stored) {
        const u = JSON.parse(stored);
        navigate(getRoleHome(u.role), { replace: true });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1fr_minmax(0,560px)]">
      {/* ---- form column ------------------------------------------------ */}
      <div className="flex flex-col min-h-screen">
        <header className="h-16 flex items-center justify-between px-6 lg:px-12 shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <DealFlowMark size={26} />
            <span className="text-[15px] font-medium text-ink tracking-tight">DealFlow360</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-subtle hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to site
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 pb-16 lg:px-12">
          <div className="w-full max-w-[400px]">
            <h1 className="type-display-md mb-2">Sign in</h1>
            <p className="type-body-md text-subtle mb-8">
              Quotes, approvals, fulfilment and billing — one thread, one login.
            </p>

            {error && (
              <div className="flex items-center gap-2 bg-coral/8 border border-coral/30 text-coral rounded-md px-4 py-3 mb-5 text-sm">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="field-label">Email</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="field-label">Password</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-ink transition-colors"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full btn-lg"
              >
                {isLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-hairline">
              <p className="type-eyebrow mb-3">Demo — one click in</p>
              <div className="grid grid-cols-5 gap-2">
                {QUICK_LOGINS.map((q) => (
                  <button
                    key={q.email}
                    id={`quick-login-${q.role.toLowerCase()}`}
                    onClick={() => quickLogin(q.email)}
                    disabled={isLoading}
                    title={`${q.email}\nPassword@123`}
                    className={`py-3 px-1 rounded-md text-[11px] font-semibold leading-none transition-opacity disabled:opacity-40 ${q.surface}`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-line-strong mt-3">
                Every demo account uses <span className="font-mono text-subtle">Password@123</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---- signature panel -------------------------------------------- */}
      <aside className="hidden lg:flex flex-col justify-between bg-dark text-white p-12">
        <p className="type-eyebrow text-white/50">Deal desk, end to end</p>

        <div>
          <p className="text-[30px] leading-[1.25] font-light tracking-tight">
            “The quote, the discount approval, the split shipment and the first
            invoice all used to live in four systems. Now they're four states of
            one record.”
          </p>
          <div className="mt-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-peach text-ink flex items-center justify-center text-xs font-semibold">
              RK
            </div>
            <div>
              <p className="text-sm font-medium">Revenue Operations</p>
              <p className="text-[13px] text-white/55">Mid-market hardware &amp; services</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/15">
          {[
            { v: '4.2×', l: 'faster quote turnaround' },
            { v: '<1 day', l: 'median approval time' },
            { v: '0', l: 'reconciliation spreadsheets' },
          ].map(s => (
            <div key={s.l}>
              <p className="text-[26px] font-light leading-none">{s.v}</p>
              <p className="text-[12px] text-white/55 mt-2 leading-snug">{s.l}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
