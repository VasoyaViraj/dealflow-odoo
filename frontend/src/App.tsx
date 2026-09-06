import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OnboardingProvider, OnboardingOverlay } from './features/onboarding';
import RoleGuard from './components/layout/RoleGuard';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import SalesWorkspace from './pages/SalesWorkspace';
import ManagerDashboard from './pages/ManagerDashboard';
import FinanceDashboard from './pages/FinanceDashboard';
import CustomerPortal from './pages/CustomerPortal';
import FulfillmentWorkspace from './pages/FulfillmentWorkspace';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OnboardingProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
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
                <RoleGuard roles={['SALES_REPRESENTATIVE', 'ADMIN']}>
                  <SalesWorkspace />
                </RoleGuard>
              }
            />

            {/* Sales Manager */}
            <Route
              path="/manager/*"
              element={
                <RoleGuard roles={['SALES_MANAGER', 'ADMIN']}>
                  <ManagerDashboard />
                </RoleGuard>
              }
            />

            {/* Finance / Operations */}
            <Route
              path="/finance/*"
              element={
                <RoleGuard roles={['FINANCE_OPERATIONS', 'ADMIN']}>
                  <FinanceDashboard />
                </RoleGuard>
              }
            />

            {/* Fulfillment / Warehouse split — operations owns the decision, and
                Admin can drive it in a demo. A rep confirms their own deal's
                split from inside the Sales Workspace instead. */}
            <Route
              path="/fulfillment/*"
              element={
                <RoleGuard roles={['FINANCE_OPERATIONS', 'ADMIN']}>
                  <FulfillmentWorkspace />
                </RoleGuard>
              }
            />

            {/* Customer Portal */}
            <Route
              path="/portal/*"
              element={
                <RoleGuard roles={['CUSTOMER', 'ADMIN']}>
                  <CustomerPortal />
                </RoleGuard>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Onboarding overlay — renders via React portal into document.body */}
          <OnboardingOverlay />
        </OnboardingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;