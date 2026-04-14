import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';

// Landing
import ModeSelectorPage from './pages/ModeSelectorPage';

// Auth pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Customer pages
import StartPage from './pages/customer/StartPage';
import PlannerPage from './pages/customer/PlannerPage';
import EstimatePage from './pages/customer/EstimatePage';
import MyPage from './pages/customer/MyPage';

// Admin pages
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminRegisterPage from './pages/admin/AdminRegisterPage';
import DashboardPage from './pages/admin/DashboardPage';
import ItemsPage from './pages/admin/ItemsPage';
import EstimatesAdminPage from './pages/admin/EstimatesAdminPage';
import CustomersPage from './pages/admin/CustomersPage';
import VersionsPage from './pages/admin/VersionsPage';
import BrandSettingsPage from './pages/admin/BrandSettingsPage';
import MarketPricePage from './pages/admin/MarketPricePage';

// Master pages
import MasterLoginPage from './pages/master/MasterLoginPage';
import MasterDashboardPage from './pages/master/MasterDashboardPage';
import CompanyManagementPage from './pages/master/CompanyManagementPage';
import MasterEstimatesPage from './pages/master/MasterEstimatesPage';
import MasterCustomersPage from './pages/master/MasterCustomersPage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontFamily: 'inherit', fontSize: '14px', borderRadius: '10px' },
        }}
      />
      <Routes>
        {/* Landing — mode selector */}
        <Route path="/" element={<ModeSelectorPage />} />

        {/* Public auth */}
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin/login" element={<PublicOnlyRoute><AdminLoginPage /></PublicOnlyRoute>} />
        <Route path="/admin/register" element={<PublicOnlyRoute><AdminRegisterPage /></PublicOnlyRoute>} />
        <Route path="/master/login" element={<PublicOnlyRoute><MasterLoginPage /></PublicOnlyRoute>} />

        {/* Customer routes (accessible by both customer and admin) */}
        <Route path="/start" element={<ProtectedRoute><StartPage /></ProtectedRoute>} />
        <Route path="/planner/:id" element={<ProtectedRoute><PlannerPage /></ProtectedRoute>} />
        <Route path="/estimate/:id" element={<ProtectedRoute><EstimatePage /></ProtectedRoute>} />
        <Route path="/my" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />

        {/* Admin routes (인테리어 업체) */}
        <Route path="/admin/dashboard" element={<ProtectedRoute adminOnly><DashboardPage /></ProtectedRoute>} />
        <Route path="/admin/items" element={<ProtectedRoute adminOnly><ItemsPage /></ProtectedRoute>} />
        <Route path="/admin/estimates" element={<ProtectedRoute adminOnly><EstimatesAdminPage /></ProtectedRoute>} />
        <Route path="/admin/market-prices" element={<ProtectedRoute adminOnly><MarketPricePage readOnly /></ProtectedRoute>} />
        <Route path="/admin/brand" element={<ProtectedRoute adminOnly><BrandSettingsPage /></ProtectedRoute>} />

        {/* Master routes */}
        <Route path="/master/dashboard" element={<ProtectedRoute masterOnly><MasterDashboardPage /></ProtectedRoute>} />
        <Route path="/master/companies" element={<ProtectedRoute masterOnly><CompanyManagementPage /></ProtectedRoute>} />
        <Route path="/master/estimates" element={<ProtectedRoute masterOnly><MasterEstimatesPage /></ProtectedRoute>} />
        <Route path="/master/customers" element={<ProtectedRoute masterOnly><MasterCustomersPage /></ProtectedRoute>} />
        <Route path="/master/items" element={<ProtectedRoute masterOnly><ItemsPage /></ProtectedRoute>} />
        <Route path="/master/market-prices" element={<ProtectedRoute masterOnly><MarketPricePage /></ProtectedRoute>} />
        <Route path="/master/versions" element={<ProtectedRoute masterOnly><VersionsPage /></ProtectedRoute>} />
        <Route path="/master/brand" element={<ProtectedRoute masterOnly><BrandSettingsPage /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
