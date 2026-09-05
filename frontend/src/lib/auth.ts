export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER' | 'SALES_REPRESENTATIVE' | 'SALES_MANAGER' | 'FINANCE_OPERATIONS' | 'ADMIN';
}

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem('df_token', token);
  localStorage.setItem('df_user', JSON.stringify(user));
}

export function getToken(): string | null {
  return localStorage.getItem('df_token');
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem('df_user');
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

export function clearAuth() {
  localStorage.removeItem('df_token');
  localStorage.removeItem('df_user');
}

export function getRoleHome(role: AuthUser['role']): string {
  const map: Record<AuthUser['role'], string> = {
    ADMIN: '/admin',
    SALES_REPRESENTATIVE: '/sales',
    SALES_MANAGER: '/manager',
    FINANCE_OPERATIONS: '/finance',
    CUSTOMER: '/portal',
  };
  return map[role] ?? '/';
}
