import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RoleGuard from './components/layout/RoleGuard';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import SalesWorkspace from './pages/SalesWorkspace';
import ManagerDashboard from './pages/ManagerDashboard';
import FinanceDashboard from './pages/FinanceDashboard';
import CustomerPortal from './pages/CustomerPortal';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Admin */}
          <Route
            path="/admin/*"
            element={
              <RoleGuard roles={['ADMIN']}>
                <AdminDashboard />
              </RoleGuard>
            }
          />

          {/* Sales Representative */}
          <Route
            path="/sales/*"
            element={
              <RoleGuard roles={['SALES_REPRESENTATIVE']}>
                <SalesWorkspace />
              </RoleGuard>
            }
          />

          {/* Sales Manager */}
          <Route
            path="/manager/*"
            element={
              <RoleGuard roles={['SALES_MANAGER']}>
                <ManagerDashboard />
              </RoleGuard>
            }
          />

          {/* Finance / Operations */}
          <Route
            path="/finance/*"
            element={
              <RoleGuard roles={['FINANCE_OPERATIONS']}>
                <FinanceDashboard />
              </RoleGuard>
            }
          />

          {/* Customer Portal */}
          <Route
            path="/portal/*"
            element={
              <RoleGuard roles={['CUSTOMER']}>
                <CustomerPortal />
              </RoleGuard>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;