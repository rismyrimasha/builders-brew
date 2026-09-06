import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireStaff } from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';

import Landing from './pages/Landing';
import StaffLogin from './pages/staff/Login';
import StaffHome from './pages/staff/Home';
import StaffCustomer from './pages/staff/Customer';

import AdminOverview from './pages/admin/Overview';
import AdminRewards from './pages/admin/Rewards';
import AdminStaff from './pages/admin/Staff';
import AdminCustomers from './pages/admin/Customers';
import AdminSettings from './pages/admin/Settings';
import AdminMessages from './pages/admin/Messages';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />

      <Route path="/staff/login" element={<StaffLogin />} />
      <Route
        path="/staff"
        element={
          <RequireStaff>
            <StaffHome />
          </RequireStaff>
        }
      />
      <Route
        path="/staff/customer/:id"
        element={
          <RequireStaff>
            <StaffCustomer />
          </RequireStaff>
        }
      />

      <Route path="/admin/login" element={<StaffLogin admin />} />
      <Route
        path="/admin"
        element={
          <RequireStaff adminOnly>
            <AdminLayout />
          </RequireStaff>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="rewards" element={<AdminRewards />} />
        <Route path="staff" element={<AdminStaff />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
