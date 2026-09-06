import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingCart,
  CheckSquare,
  DollarSign,
  Globe,
  Settings,
  Truck,
  LogOut,
} from 'lucide-react';
import type { AuthUser } from '../../lib/auth';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  roles: AuthUser['role'][];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Admin Panel',    to: '/admin',   icon: <Settings size={17} />,      roles: ['ADMIN'] },
  { label: 'Sales Workspace', to: '/sales',   icon: <ShoppingCart size={17} />,  roles: ['SALES_REPRESENTATIVE', 'ADMIN'] },
  { label: 'Approvals',      to: '/manager', icon: <CheckSquare size={17} />,   roles: ['SALES_MANAGER', 'ADMIN'] },
  { label: 'Finance',        to: '/finance', icon: <DollarSign size={17} />,    roles: ['FINANCE_OPERATIONS', 'ADMIN'] },
  { label: 'Fulfillment',    to: '/fulfillment', icon: <Truck size={17} />,     roles: ['FINANCE_OPERATIONS', 'ADMIN'] },
  { label: 'My Portal',      to: '/portal',  icon: <Globe size={17} />,         roles: ['CUSTOMER', 'ADMIN'] },
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

/* Roles get a signature card surface rather than a saturated accent chip —
   the same palette the marketing pages use for their voltage moments. */
function roleBadgeColor(role: AuthUser['role']) {
  const m: Record<string, string> = {
    ADMIN: 'bg-cream text-ink border-mustard/40',
    SALES_REPRESENTATIVE: 'bg-link/8 text-link border-link/25',
    SALES_MANAGER: 'bg-mint/40 text-forest border-forest/20',
    FINANCE_OPERATIONS: 'bg-mustard/20 text-warning border-mustard/50',
    CUSTOMER: 'bg-peach/30 text-coral border-coral/25',
  };
  return m[role] ?? 'bg-soft text-subtle border-hairline';
}

export function DealFlowMark({ size = 32 }: { size?: number }) {
  /* A refined, simple geometric logo of isometric layers representing
     platform structure and deal workflow stages (Build -> Approve -> Fulfill).
     Uses the brand's core signature colors. */
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* Top Layer: Platform (Ink) */}
      <path
        d="M16 6 L6 11 L16 16 L26 11 Z"
        fill="#181d26"
        stroke="#181d26"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Middle Layer (Coral) */}
      <path
        d="M6 16.5 L16 21.5 L26 16.5"
        fill="none"
        stroke="#aa2d00"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom Layer (Mint) */}
      <path
        d="M6 22 L16 27 L26 22"
        fill="none"
        stroke="#a8d8c4"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
    <div className="flex h-screen bg-canvas text-body overflow-hidden">
      {/* Sidebar — white canvas separated by a hairline, never a dark rail */}
      <aside className="w-[248px] flex flex-col bg-canvas border-r border-hairline shrink-0">
        <div data-onboarding-id="app-logo" className="flex items-center gap-3 px-5 h-16 border-b border-hairline">
          <DealFlowMark size={30} />
          <div>
            <p className="text-[15px] font-medium text-ink leading-none tracking-tight">
              DealFlow360
            </p>
            <p className="text-[11px] text-subtle mt-1">B2B revenue operations</p>
          </div>
        </div>

        <nav data-onboarding-id="sidebar-nav" className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="type-eyebrow px-3 pb-2 text-[10px]">Workspace</p>
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-ink text-white font-medium'
                    : 'text-body font-normal hover:bg-soft hover:text-ink'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div data-onboarding-id="user-info" className="border-t border-hairline p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-ink flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate leading-tight">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[11px] text-subtle truncate">{user.email}</p>
              </div>
            </div>
            <span
              className={`inline-block text-[11px] px-2 py-0.5 rounded-full border font-medium mb-3 ${roleBadgeColor(user.role)}`}
            >
              {roleLabel(user.role)}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-subtle hover:text-coral hover:bg-coral/6 rounded-md transition-colors"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
