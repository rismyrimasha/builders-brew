import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { ErrorBanner, PlateTag, Spinner, SuccessBanner } from '../../components/ui';

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    points_per_100: 1,
    minimum_spend: 100,
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => (await api.get('/admin/settings')).data,
  });

  useEffect(() => {
    if (data?.settings) {
      setForm({
        points_per_100: data.settings.points_per_100,
        minimum_spend: data.settings.minimum_spend,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () =>
      (
        await api.put('/admin/settings', {
          points_per_100: Number(form.points_per_100),
          minimum_spend: Number(form.minimum_spend),
        })
      ).data,
    onSuccess: () => {
      setMessage('Settings saved');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PlateTag>Rules</PlateTag>
      <h1 className="mt-3 font-display text-4xl text-cream-50">Settings</h1>
      <p className="mt-2 text-muted">
        Earning rate is admin-editable so you can run promotions like double points weekends.
      </p>

      <div className="mt-4 space-y-2">
        <ErrorBanner message={error} />
        <SuccessBanner message={message} />
      </div>

      <form
        className="surface mt-6 grid gap-4 p-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="block space-y-2">
          <span className="text-sm text-muted">Points per Rs 100 spent</span>
          <input
            className="field"
            type="number"
            min={0}
            step={1}
            value={form.points_per_100}
            onChange={(e) => setForm({ ...form, points_per_100: e.target.value })}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-muted">Minimum spend to earn (Rs)</span>
          <input
            className="field"
            type="number"
            min={0}
            value={form.minimum_spend}
            onChange={(e) => setForm({ ...form, minimum_spend: e.target.value })}
          />
        </label>
        <button className="btn-gold md:col-span-2 md:justify-self-start" type="submit" disabled={save.isPending}>
          Save settings
        </button>
      </form>

      <div className="surface mt-6 p-5 text-sm text-muted">
        <p className="font-medium text-cream-200">How membership works</p>
        <p className="mt-2">
          There is no customer app. Staff look up or register members by phone at the counter,
          award points on paid bills, and redeem rewards after a verbal confirm.
        </p>
      </div>
    </div>
  );
}
