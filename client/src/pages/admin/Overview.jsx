import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { PlateTag, Spinner } from '../../components/ui';

function Stat({ label, value }) {
  return (
    <div className="surface p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl text-gold-300 tabular-nums">{value}</p>
    </div>
  );
}

export default function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => (await api.get('/admin/overview')).data,
  });

  if (isLoading) return <Spinner />;

  const m = data.this_month;

  return (
    <div>
      <PlateTag>Dashboard</PlateTag>
      <h1 className="mt-3 font-display text-4xl text-cream-50">Overview</h1>
      <p className="mt-2 text-muted">This month&apos;s loyalty pulse.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Customers" value={data.total_customers.toLocaleString()} />
        <Stat label="Points issued" value={m.points_issued.toLocaleString()} />
        <Stat label="Points redeemed" value={m.points_redeemed.toLocaleString()} />
        <Stat label="Orders logged" value={m.orders.toLocaleString()} />
      </div>

      <section className="surface mt-6 p-5">
        <h2 className="font-display text-2xl text-cream-50">Top redeemed rewards</h2>
        {data.top_rewards?.length ? (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="pb-2 font-medium">Reward</th>
                <th className="pb-2 font-medium">Times</th>
                <th className="pb-2 font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {data.top_rewards.map((r) => (
                <tr key={r.reward_id} className="border-t border-ink-700">
                  <td className="py-3 text-cream-50">{r.name}</td>
                  <td className="py-3 tabular-nums">{r.count}</td>
                  <td className="py-3 tabular-nums text-gold-300">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-muted">No redemptions yet.</p>
        )}
      </section>
    </div>
  );
}
