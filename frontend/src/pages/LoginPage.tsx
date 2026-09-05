import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleHome } from '../lib/auth';
import { Zap, AlertCircle, Eye, EyeOff } from 'lucide-react';

const QUICK_LOGINS = [
  { label: 'Admin',        email: 'admin@dealflow.com',    role: 'ADMIN',                color: 'from-purple-500 to-indigo-600' },
  { label: 'Sales Rep',    email: 'sales@dealflow.com',    role: 'SALES_REPRESENTATIVE', color: 'from-blue-500 to-cyan-600' },
  { label: 'Manager',      email: 'manager@dealflow.com',  role: 'SALES_MANAGER',        color: 'from-emerald-500 to-teal-600' },
  { label: 'Finance',      email: 'finance@dealflow.com',  role: 'FINANCE_OPERATIONS',   color: 'from-amber-500 to-orange-600' },
  { label: 'Customer',     email: 'customer@dealflow.com', role: 'CUSTOMER',             color: 'from-sky-500 to-blue-600' },
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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/30 via-zinc-950 to-indigo-950/20 pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-2xl shadow-violet-500/30 mb-4">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">DealFlow360</h1>
          <p className="text-zinc-400 mt-1 text-sm">Intelligent B2B Sales Operations</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in</h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5 font-medium">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 pr-10 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-2.5 rounded-lg transition-all duration-150 shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Quick-login demo buttons */}
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 text-center mb-3 font-medium uppercase tracking-wider">Demo — Quick Login</p>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_LOGINS.map((q) => (
                <button
                  key={q.email}
                  id={`quick-login-${q.role.toLowerCase()}`}
                  onClick={() => quickLogin(q.email)}
                  disabled={isLoading}
                  title={`${q.email}\nPassword@123`}
                  className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl bg-gradient-to-br ${q.color} opacity-80 hover:opacity-100 transition-all duration-150 disabled:opacity-40 text-white shadow-lg`}
                >
                  <span className="text-xs font-bold leading-none">{q.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-600 text-center mt-2">All use password: <span className="font-mono text-zinc-500">Password@123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
