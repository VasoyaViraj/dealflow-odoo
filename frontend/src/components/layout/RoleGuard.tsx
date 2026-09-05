import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { AuthUser } from '../../lib/auth';
import type { ReactNode } from 'react';

interface RoleGuardProps {
  roles: AuthUser['role'][];
  children: ReactNode;
}

export default function RoleGuard({ roles, children }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
