import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { isAdminRole } from '../../lib/roles';
import { BrandMark, ErrorBanner, PlateTag } from '../../components/ui';

export default function StaffLogin({ admin = false }) {
  const { staffToken, staff, setStaffSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (staffToken) {
    if (admin && isAdminRole(staff?.role)) return <Navigate to="/admin" replace />;
    if (!admin) return <Navigate to="/staff" replace />;
    if (admin && !isAdminRole(staff?.role)) return <Navigate to="/staff" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/staff/login', { email, password });
      if (admin && !isAdminRole(data.account.role)) {
        setError('This account is not an admin');
        return;
      }
      setStaffSession(data.token, data.account);
      navigate(admin ? '/admin' : '/staff');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not sign in'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-6 text-sm text-gold-300 hover:underline">
        ← Back to home
      </Link>
      <PlateTag>{admin ? 'Admin' : 'Staff'}</PlateTag>
      <div className="mt-4">
        <BrandMark size="md" />
      </div>
      <p className="mt-2 text-cream-200">
        {admin
          ? 'Manage rewards, staff, and reports.'
          : 'Counter tools — look up members, award points, redeem rewards.'}
      </p>
      <p className="mt-2 text-sm text-muted">Sign in with email + password.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <ErrorBanner message={error} />
        <label className="block space-y-2">
          <span className="text-sm text-muted">Email</span>
          <input
            className="field"
            type="email"
            autoComplete="username"
            placeholder="you@buildersbrew.lk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-muted">Password</span>
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="btn-gold w-full !min-h-14 text-lg" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Need the other portal?{' '}
        <Link
          className="text-gold-300 underline-offset-4 hover:underline"
          to={admin ? '/staff/login' : '/admin/login'}
        >
          {admin ? 'Staff login' : 'Admin login'}
        </Link>
      </p>
    </div>
  );
}
