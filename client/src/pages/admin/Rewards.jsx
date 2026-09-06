import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { ErrorBanner, PlateTag, Spinner, SuccessBanner } from '../../components/ui';

const emptyForm = {
  name: '',
  description: '',
  points_cost: 50,
  type: 'cash_credit',
  cash_value: 500,
  active: true,
};

export default function AdminRewards() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-rewards'],
    queryFn: async () => (await api.get('/admin/rewards')).data,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        points_cost: Number(form.points_cost),
        cash_value: form.type === 'cash_credit' ? Number(form.cash_value) : null,
      };
      if (editingId) {
        return (await api.put(`/admin/rewards/${editingId}`, payload)).data;
      }
      return (await api.post('/admin/rewards', payload)).data;
    },
    onSuccess: () => {
      setMessage(editingId ? 'Reward updated' : 'Reward created');
      setError('');
      setForm(emptyForm);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/rewards/${id}`)).data,
    onSuccess: (_data, id) => {
      setMessage('Reward deleted');
      setError('');
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  function startEdit(reward) {
    setEditingId(reward._id);
    setForm({
      name: reward.name,
      description: reward.description || '',
      points_cost: reward.points_cost,
      type: reward.type,
      cash_value: reward.cash_value || 0,
      active: reward.active,
    });
  }

  return (
    <div>
      <PlateTag>Catalog</PlateTag>
      <h1 className="mt-3 font-display text-4xl text-cream-50">Rewards</h1>

      <div className="mt-4 space-y-2">
        <ErrorBanner message={error} />
        <SuccessBanner message={message} />
      </div>

      <form
        className="surface mt-6 grid gap-3 p-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="font-display text-2xl md:col-span-2">
          {editingId ? 'Edit reward' : 'New reward'}
        </h2>
        <label className="block space-y-1 md:col-span-2">
          <span className="text-sm text-muted">Name</span>
          <input
            className="field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label className="block space-y-1 md:col-span-2">
          <span className="text-sm text-muted">Description</span>
          <textarea
            className="field min-h-24"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Points cost</span>
          <input
            className="field"
            type="number"
            min={1}
            value={form.points_cost}
            onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Type</span>
          <select
            className="field"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="cash_credit">Cash credit</option>
            <option value="menu_item">Menu item</option>
          </select>
        </label>
        {form.type === 'cash_credit' && (
          <label className="block space-y-1">
            <span className="text-sm text-muted">Cash value (Rs)</span>
            <input
              className="field"
              type="number"
              min={0}
              value={form.cash_value}
              onChange={(e) => setForm({ ...form, cash_value: e.target.value })}
            />
          </label>
        )}
        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          <span className="text-sm text-cream-200">Active</span>
        </label>
        <div className="flex gap-2 md:col-span-2">
          <button className="btn-gold" type="submit" disabled={save.isPending}>
            {editingId ? 'Save changes' : 'Create reward'}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="mt-6 overflow-x-auto surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.rewards?.map((r) => (
                <tr key={r._id} className="border-t border-ink-700">
                  <td className="px-4 py-3">
                    <p className="text-cream-50">{r.name}</p>
                    <p className="text-xs text-muted line-clamp-1">{r.description}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-cream-200">
                    {r.type.replace('_', ' ')}
                    {r.cash_value ? ` · Rs ${r.cash_value}` : ''}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gold-300">{r.points_cost}</td>
                  <td className="px-4 py-3">{r.active ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        className="text-gold-300 hover:underline"
                        onClick={() => startEdit(r)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-error hover:underline disabled:opacity-50"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete "${r.name}"? This cannot be undone.`)) {
                            remove.mutate(r._id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
