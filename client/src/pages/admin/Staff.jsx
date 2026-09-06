import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { roleLabel } from '../../lib/roles';
import { validatePassword } from '../../lib/password';
import { ErrorBanner, PlateTag, Spinner, SuccessBanner } from '../../components/ui';

export default function AdminStaff() {
  const queryClient = useQueryClient();
  const { staff } = useAuth();
  const isPlatformOwner = staff?.role === 'platform_owner';
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => (await api.get('/admin/staff')).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/admin/staff', form)).data,
    onSuccess: () => {
      setMessage('Staff account created');
      setError('');
      setForm({ name: '', email: '', password: '', role: 'staff' });
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }) =>
      (await api.put(`/admin/staff/${id}`, { active })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-staff'] }),
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div>
      <PlateTag>Team</PlateTag>
      <h1 className="mt-3 font-display text-4xl text-cream-50">Staff accounts</h1>

      <div className="mt-4 space-y-2">
        <ErrorBanner message={error} />
        <SuccessBanner message={message} />
      </div>

      <form
        className="surface mt-6 grid gap-3 p-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const passwordError = validatePassword(form.password);
          if (passwordError) {
            setError(passwordError);
            return;
          }
          create.mutate();
        }}
      >
        <input
          className="field"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="field"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <div className="space-y-1">
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            required
          />
          <p className="text-xs text-muted">
            Min 8 characters, include a letter and a special character (e.g. @ ! # $)
          </p>
        </div>
        <select
          className="field"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
          {isPlatformOwner && <option value="platform_owner">Platform Owner</option>}
        </select>
        <button className="btn-gold md:col-span-2" type="submit">
          Create account
        </button>
      </form>

      {isLoading ? (
        <Spinner />
      ) : (
        <ul className="mt-6 space-y-2">
          {data?.staff?.map((s) => (
            <li key={s._id} className="surface flex items-center justify-between gap-3 px-4 py-4">
              <div>
                <p className="text-cream-50">{s.name}</p>
                <p className="text-sm text-muted">
                  {s.email} · {roleLabel(s.role)}
                </p>
              </div>
              {s.role === 'platform_owner' && !isPlatformOwner ? (
                <span className="text-xs text-muted">Managed by platform owner</span>
              ) : (
                <button
                  type="button"
                  className="btn-ghost !min-h-10 text-sm"
                  onClick={() => toggle.mutate({ id: s._id, active: !s.active })}
                >
                  {s.active ? 'Deactivate' : 'Activate'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
