import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  CheckSquare,
  DollarSign,
  Globe,
  Settings,
  Truck,
  LogOut,
  Zap,
} from 'lucide-react';
import type { AuthUser } from '../../lib/auth';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  roles: AuthUser['role'][];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Admin Panel',    to: '/admin',   icon: <Settings size={18} />,      roles: ['ADMIN'] },
  { label: 'Sales Workspace', to: '/sales',   icon: <ShoppingCart size={18} />,  roles: ['SALES_REPRESENTATIVE'] },
  { label: 'Approvals',      to: '/manager', icon: <CheckSquare size={18} />,   roles: ['SALES_MANAGER'] },
  { label: 'Finance',        to: '/finance', icon: <DollarSign size={18} />,    roles: ['FINANCE_OPERATIONS'] },
  { label: 'Fulfillment',    to: '/fulfillment', icon: <Truck size={18} />,     roles: ['FINANCE_OPERATIONS', 'ADMIN'] },
  { label: 'My Portal',      to: '/portal',  icon: <Globe size={18} />,         roles: ['CUSTOMER'] },
];

function roleLabel(role: AuthUser['role']) {
  const m: Record<string, string> = {
    ADMIN: 'Administrator',
    SALES_REPRESENTATIVE: 'Sales Rep',
    SALES_MANAGER: 'Sales Manager',
    FINANCE_OPERATIONS: 'Finance / Ops',
    CUSTOMER: 'Customer',
  };
  return m[role] ?? role;
}

function roleBadgeColor(role: AuthUser['role']) {
  const m: Record<string, string> = {
    ADMIN: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    SALES_REPRESENTATIVE: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    SALES_MANAGER: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    FINANCE_OPERATIONS: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    CUSTOMER: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  };
  return m[role] ?? 'bg-zinc-500/20 text-zinc-300';
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = NAV_ITEMS.filter(item =>
    user ? item.roles.includes(user.role) : false
  );

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-zinc-900 border-r border-zinc-800 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">DealFlow360</p>
            <p className="text-xs text-zinc-500 mt-0.5">B2B Sales Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        {user && (
          <div className="border-t border-zinc-800 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100 truncate">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium mb-3 ${roleBadgeColor(user.role)}`}>
              {roleLabel(user.role)}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-150"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
