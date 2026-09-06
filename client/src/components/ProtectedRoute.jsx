import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isAdminRole } from '../lib/roles';

export function RequireStaff({ children, adminOnly = false }) {
  const { staffToken, staff } = useAuth();
  const location = useLocation();

  if (!staffToken) {
    return (
      <Navigate
        to={adminOnly ? '/admin/login' : '/staff/login'}
        replace
        state={{ from: location }}
      />
    );
  }

  if (adminOnly && !isAdminRole(staff?.role)) {
    return <Navigate to="/staff" replace />;
  }

  return children;
}
