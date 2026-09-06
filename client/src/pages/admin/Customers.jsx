import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import {
  ErrorBanner,
  PlateTag,
  PointsNumber,
  Spinner,
  SuccessBanner,
} from '../../components/ui';

export default function AdminCustomers() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const listQuery = useQuery({
    queryKey: ['admin-customers', q],
    queryFn: async () => (await api.get('/admin/customers', { params: { q } })).data,
  });

  const detailQuery = useQuery({
    queryKey: ['admin-customer', selectedId],
    queryFn: async () => (await api.get(`/admin/customers/${selectedId}`)).data,
    enabled: !!selectedId,
  });

  const adjust = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/admin/customers/${selectedId}/adjustments`, {
          points_delta: Number(delta),
          reason,
        })
      ).data,
    onSuccess: () => {
      setMessage('Adjustment recorded');
      setError('');
      setDelta('');
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-customer', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div>
      <PlateTag>Members</PlateTag>
      <h1 className="mt-3 font-display text-4xl text-cream-50">Customers</h1>

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          listQuery.refetch();
        }}
      >
        <input
          className="field"
          placeholder="Search name or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn-gold" type="submit">
          Search
        </button>
      </form>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          {listQuery.isLoading ? (
            <Spinner />
          ) : (
            <ul className="space-y-2">
              {listQuery.data?.customers?.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`surface flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition ${
                      selectedId === c.id ? 'border-gold-500' : 'hover:border-gold-700'
                    }`}
                  >
                    <div>
                      <p className="text-cream-50">{c.name}</p>
                      <p className="text-sm text-muted">{c.phone}</p>
                    </div>
                    <PointsNumber value={c.balance.available} className="text-2xl" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface p-5">
          {!selectedId ? (
            <p className="text-muted">Select a customer to view ledger and adjust points.</p>
          ) : detailQuery.isLoading ? (
            <Spinner />
          ) : (
            <>
              <h2 className="font-display text-3xl text-cream-50">
                {detailQuery.data.customer.name}
              </h2>
              <p className="text-muted">{detailQuery.data.customer.phone}</p>
              <p className="mt-3 text-sm text-muted">
                Available{' '}
                <PointsNumber
                  value={detailQuery.data.balance.available}
                  className="text-base"
                />{' '}
                · Ledger balance{' '}
                <PointsNumber value={detailQuery.data.balance.balance} className="text-base" />
              </p>

              <div className="mt-4 space-y-2">
                <ErrorBanner message={error} />
                <SuccessBanner message={message} />
              </div>

              <form
                className="mt-4 space-y-3 border-t border-ink-700 pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  adjust.mutate();
                }}
              >
                <p className="text-sm font-medium text-cream-200">Manual adjustment (admin only)</p>
                <input
                  className="field"
                  type="number"
                  placeholder="Points delta (+/-)"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  required
                />
                <input
                  className="field"
                  placeholder="Reason (required)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
                <button className="btn-gold" type="submit" disabled={adjust.isPending}>
                  Post adjustment
                </button>
              </form>

              <ul className="mt-6 max-h-96 space-y-2 overflow-y-auto">
                {detailQuery.data.ledger.map((entry) => (
                  <li
                    key={`${entry.kind}-${entry.id}`}
                    className="flex justify-between gap-3 border-t border-ink-700 py-2 text-sm"
                  >
                    <div>
                      <p className="text-cream-50">
                        {entry.kind}
                        {entry.reason ? `: ${entry.reason}` : ''}
                        {entry.reward?.name ? `: ${entry.reward.name}` : ''}
                        {entry.amount_paid != null ? ` · Rs ${entry.amount_paid}` : ''}
                      </p>
                      <p className="text-xs text-muted">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`tabular-nums ${
                        entry.points >= 0 ? 'text-success' : 'text-gold-300'
                      }`}
                    >
                      {entry.points >= 0 ? '+' : ''}
                      {entry.points}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
