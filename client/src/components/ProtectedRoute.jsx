import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export function ProtectedRoute({ children, adminOnly = false, masterOnly = false }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/" replace />;

  if (masterOnly && user?.role !== 'master') return <Navigate to="/" replace />;
  if (adminOnly && user?.role !== 'admin' && user?.role !== 'master') return <Navigate to="/my" replace />;

  return children;
}

export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated) {
    if (user?.role === 'master') return <Navigate to="/master/dashboard" replace />;
    if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/my" replace />;
  }
  return children;
}
