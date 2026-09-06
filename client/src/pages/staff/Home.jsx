import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { getErrorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { isAdminRole } from '../../lib/roles';
import { validatePhone } from '../../lib/phone';
import {
  BrandMark,
  ErrorBanner,
  PlateTag,
  PointsNumber,
  Spinner,
  SuccessBanner,
} from '../../components/ui';

export default function StaffHome() {
  const { staff, clearStaffSession } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [searchedPhone, setSearchedPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');

  const searchQuery = useQuery({
    queryKey: ['staff-search', searchedPhone],
    queryFn: async () =>
      (await api.get('/staff/customers/search', { params: { q: searchedPhone } })).data,
    enabled: !!searchedPhone,
  });

  async function onSearch(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    const phoneCheck = validatePhone(q);
    if (!phoneCheck.ok) {
      setError(phoneCheck.error);
      setSearchedPhone('');
      return;
    }

    const phone = phoneCheck.phone;
    setQ(phone);
    setRegPhone(phone);
    setSearching(true);
    setSearchedPhone(phone);
    try {
      const { data } = await api.get('/staff/customers/search', { params: { q: phone } });
      queryClient.setQueryData(['staff-search', phone], data);
    } catch (err) {
      setError(getErrorMessage(err));
      setSearchedPhone('');
    } finally {
      setSearching(false);
    }
  }

  const register = useMutation({
    mutationFn: async (phone) =>
      (
        await api.post('/staff/customers', {
          name: regName,
          phone,
        })
      ).data,
    onSuccess: (profile) => {
      setMessage(`Registered ${profile.customer.name}`);
      setError('');
      navigate(`/staff/customer/${profile.customer.id}`);
    },
    onError: (err) => {
      const existingId = err?.response?.data?.customer?.id;
      if (err?.response?.status === 409 && existingId) {
        navigate(`/staff/customer/${existingId}`);
        return;
      }
      setError(getErrorMessage(err));
    },
  });

  function onRegister(e) {
    e.preventDefault();
    setError('');
    const phoneCheck = validatePhone(regPhone || q);
    if (!phoneCheck.ok) {
      setError(phoneCheck.error);
      return;
    }
    if (!regName.trim()) {
      setError('Customer name is required');
      return;
    }
    setRegPhone(phoneCheck.phone);
    register.mutate(phoneCheck.phone);
  }

  const noMatches =
    !!searchedPhone &&
    !searching &&
    !searchQuery.isFetching &&
    searchQuery.data?.customers?.length === 0;
  const phoneFieldValue = regPhone || q;
  const phonePreview = phoneFieldValue ? validatePhone(phoneFieldValue) : null;

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PlateTag>Counter</PlateTag>
          <div className="mt-2">
            <BrandMark size="md" />
          </div>
          <p className="mt-1 text-muted">Signed in as {staff?.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdminRole(staff?.role) && (
            <Link to="/admin" className="btn-ghost !min-h-11 text-sm">
              Admin
            </Link>
          )}
          <button type="button" className="btn-ghost !min-h-11 text-sm" onClick={clearStaffSession}>
            Sign out
          </button>
        </div>
      </header>

      <p className="mt-4 text-cream-200">
        Ask for the customer&apos;s phone number, look them up, then earn or redeem points at the
        counter.
      </p>

      <div className="mt-6 space-y-3">
        <ErrorBanner message={error} />
        <SuccessBanner message={message} />

        <form onSubmit={onSearch} className="surface p-4">
          <label className="block space-y-2">
            <span className="text-sm text-muted">Customer phone number</span>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="field !min-h-14 text-lg"
                inputMode="tel"
                placeholder="07XXXXXXXX"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
              <button className="btn-gold !min-h-14 px-8 text-lg" type="submit">
                Look up
              </button>
            </div>
          </label>
        </form>
      </div>

      <section className="mt-6">
        {(searching || searchQuery.isFetching) && <Spinner label="Searching…" />}

        {searchQuery.data?.customers?.length > 0 && (
          <ul className="space-y-2">
            {searchQuery.data.customers.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/staff/customer/${c.id}`}
                  className="surface flex items-center justify-between gap-3 px-4 py-4 transition hover:border-gold-700"
                >
                  <div>
                    <p className="text-xl font-medium text-cream-50">{c.name}</p>
                    <p className="text-muted">{c.phone}</p>
                  </div>
                  <div className="text-right">
                    <PointsNumber value={c.balance.available} className="text-3xl" />
                    <p className="text-xs text-muted">points</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {noMatches && (
          <form className="surface mt-2 space-y-3 p-5" onSubmit={onRegister}>
            <PlateTag>New member</PlateTag>
            <h2 className="font-display text-2xl text-cream-50">Register for loyalty</h2>
            <p className="text-sm text-muted">
              No match found. Enroll them now with name + a valid mobile number.
            </p>
            <label className="block space-y-2">
              <span className="text-sm text-muted">Name</span>
              <input
                className="field !min-h-14"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-muted">Phone</span>
              <input
                className="field !min-h-14"
                inputMode="tel"
                placeholder="07XXXXXXXX"
                maxLength={15}
                value={phoneFieldValue}
                onChange={(e) => setRegPhone(e.target.value)}
                required
              />
              <p className="text-xs text-muted">
                Sri Lanka mobile: 07 followed by 8 digits (e.g. 0712345678). +94 format also
                accepted.
              </p>
              {phoneFieldValue && phonePreview && !phonePreview.ok && (
                <p className="text-sm text-error">{phonePreview.error}</p>
              )}
              {phonePreview?.ok && (
                <p className="text-sm text-success">Will save as {phonePreview.phone}</p>
              )}
            </label>
            <button
              className="btn-gold w-full !min-h-14 text-lg"
              type="submit"
              disabled={register.isPending || (phoneFieldValue && phonePreview && !phonePreview.ok)}
            >
              {register.isPending ? 'Saving…' : 'Register & open profile'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
