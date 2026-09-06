import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import {
  EmptyState,
  ErrorBanner,
  Modal,
  PlateTag,
  PointsNumber,
  Spinner,
  SuccessBanner,
} from '../../components/ui';

function formatActivity(entry) {
  if (entry.kind === 'earn') return `Order · Rs ${entry.amount_paid?.toLocaleString()}`;
  if (entry.kind === 'redemption') {
    return `Redeemed · ${entry.reward?.name || 'Reward'}`;
  }
  if (entry.kind === 'adjustment') return `Adjustment · ${entry.reason}`;
  return 'Activity';
}

export default function StaffCustomer() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [pendingRedeem, setPendingRedeem] = useState(null);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['staff-customer', id],
    queryFn: async () => (await api.get(`/staff/customers/${id}`)).data,
  });

  async function onAmountChange(value) {
    setAmount(value);
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      setPreview(null);
      return;
    }
    try {
      const { data: p } = await api.post('/staff/orders/preview', { amount_paid: n });
      setPreview(p);
    } catch {
      setPreview(null);
    }
  }

  const logOrder = useMutation({
    mutationFn: async () =>
      (
        await api.post('/staff/orders', {
          customer_id: id,
          amount_paid: Number(amount),
          order_ref: orderRef,
        })
      ).data,
    onSuccess: (result) => {
      setMessage(
        `Logged Rs ${result.transaction.amount_paid.toLocaleString()} → +${result.transaction.points_earned} pts`
      );
      setError('');
      setAmount('');
      setOrderRef('');
      setPreview(null);
      queryClient.setQueryData(['staff-customer', id], {
        customer: result.customer,
        balance: result.balance,
        next_reward: result.next_reward,
        reward_tiers: result.reward_tiers,
        affordable_rewards: result.affordable_rewards,
        rewards: result.rewards,
        recent_activity: result.recent_activity,
      });
    },
    onError: (err) => {
      setMessage('');
      setError(getErrorMessage(err));
    },
  });

  const redeem = useMutation({
    mutationFn: async (rewardId) =>
      (
        await api.post('/staff/redemptions', {
          customer_id: id,
          reward_id: rewardId,
        })
      ).data,
    onSuccess: (result) => {
      setMessage(
        `Redeemed “${result.redemption.reward.name}” (−${result.redemption.points_spent} pts)`
      );
      setError('');
      setPendingRedeem(null);
      queryClient.setQueryData(['staff-customer', id], {
        customer: result.customer,
        balance: result.balance,
        next_reward: result.next_reward,
        reward_tiers: result.reward_tiers,
        affordable_rewards: result.affordable_rewards,
        rewards: result.rewards,
        recent_activity: result.recent_activity,
      });
    },
    onError: (err) => {
      setMessage('');
      setError(getErrorMessage(err));
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Spinner />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState title="Customer not found" body={getErrorMessage(loadError)} />
        <Link to="/staff" className="mt-4 inline-block text-gold-300">
          ← Back
        </Link>
      </div>
    );
  }

  const { customer, balance, next_reward, reward_tiers, recent_activity } = data;
  const progress =
    next_reward && next_reward.points_cost > 0
      ? Math.min(100, (balance.available / next_reward.points_cost) * 100)
      : 100;
  const remaining = next_reward
    ? Math.max(0, next_reward.points_cost - balance.available)
    : 0;

  function askRedeem(reward, label) {
    setPendingRedeem({ reward, label });
  }

  function confirmPendingRedeem() {
    if (!pendingRedeem) return;
    redeem.mutate(pendingRedeem.reward._id);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-6 pb-10">
      <Link to="/staff" className="text-sm text-gold-300">
        ← Back to lookup
      </Link>

      <header className="surface mt-4 p-5">
        <PlateTag>Member</PlateTag>
        <h1 className="mt-2 font-display text-4xl text-cream-50">{customer.name}</h1>
        <p className="text-muted">{customer.phone}</p>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-muted">Points balance</p>
          <div className="flex items-end gap-2">
            <PointsNumber value={balance.available} className="text-6xl leading-none" />
            <span className="mb-2 text-muted">pts</span>
          </div>
        </div>

        {next_reward && (
          <div className="mt-5">
            <div className="mb-2 flex justify-between gap-3 text-sm">
              <span className="text-cream-200">
                {remaining === 0
                  ? `Ready for ${next_reward.points_cost} pt reward`
                  : `Next tier: ${next_reward.points_cost} pts`}
              </span>
              <span className="shrink-0 text-muted">
                {remaining === 0 ? 'Redeemable' : `${remaining} pts to go`}
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </header>

      <div className="mt-4 space-y-3">
        <ErrorBanner message={error} />
        <SuccessBanner message={message} />
      </div>

      <section className="surface mt-6 p-5">
        <h2 className="font-display text-3xl text-cream-50">Log order</h2>
        <p className="mt-1 text-sm text-muted">
          Enter amount actually paid (after any discount).
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            logOrder.mutate();
          }}
        >
          <label className="block space-y-2">
            <span className="text-sm text-muted">Amount paid (Rs)</span>
            <input
              className="field !min-h-16 text-3xl tabular-nums"
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              required
            />
          </label>
          {preview && (
            <p className="text-lg text-gold-300">
              Will award <strong>{preview.points_earned}</strong> points
              {preview.points_earned === 0
                ? ` (below Rs ${preview.minimum_spend} minimum)`
                : ''}
            </p>
          )}
          <label className="block space-y-2">
            <span className="text-sm text-muted">Order ref (optional)</span>
            <input
              className="field !min-h-14"
              value={orderRef}
              onChange={(e) => setOrderRef(e.target.value)}
            />
          </label>
          <button
            className="btn-gold w-full !min-h-16 text-xl"
            type="submit"
            disabled={logOrder.isPending}
          >
            {logOrder.isPending ? 'Saving…' : 'Confirm & award points'}
          </button>
        </form>
      </section>

      <section className="mt-6">
        <PlateTag>Rewards</PlateTag>
        <h2 className="mt-2 font-display text-3xl text-cream-50">Redeem for customer</h2>
        <p className="mt-1 text-sm text-muted">
          Each tier is one redeem — choose free food or cash credit.
        </p>

        {!reward_tiers?.length ? (
          <div className="mt-4">
            <EmptyState title="No active rewards" />
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {reward_tiers.map((tier) => {
              const food = tier.menu_item;
              const cash = tier.cash_credit;
              const cashLabel = cash?.cash_value
                ? `Rs ${cash.cash_value.toLocaleString()} cash`
                : 'Cash credit';

              return (
                <li key={tier.points_cost} className="surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-gold-300">
                        Reward tier
                      </p>
                      <h3 className="mt-1 font-display text-3xl text-cream-50">
                        {tier.points_cost} points
                      </h3>
                      {!tier.affordable && (
                        <p className="mt-2 text-sm text-muted">
                          Needs {tier.points_short} more points
                        </p>
                      )}
                    </div>
                    <PointsNumber value={tier.points_cost} className="text-4xl" />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {food && (
                      <button
                        type="button"
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          tier.affordable
                            ? 'border-ink-700 bg-ink-900 hover:border-gold-500'
                            : 'cursor-not-allowed border-ink-800 opacity-45'
                        }`}
                        disabled={!tier.affordable || redeem.isPending}
                        onClick={() => askRedeem(food, 'free food')}
                      >
                        <p className="text-xs uppercase tracking-[0.14em] text-gold-300">
                          Free food
                        </p>
                        <p className="mt-2 font-medium text-cream-50">Menu pick</p>
                        <p className="mt-1 text-sm leading-snug text-muted line-clamp-3">
                          {food.description}
                        </p>
                      </button>
                    )}
                    {cash && (
                      <button
                        type="button"
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          tier.affordable
                            ? 'border-ink-700 bg-ink-900 hover:border-gold-500'
                            : 'cursor-not-allowed border-ink-800 opacity-45'
                        }`}
                        disabled={!tier.affordable || redeem.isPending}
                        onClick={() => askRedeem(cash, cashLabel)}
                      >
                        <p className="text-xs uppercase tracking-[0.14em] text-gold-300">
                          Cash credit
                        </p>
                        <p className="mt-2 font-medium text-cream-50">{cashLabel}</p>
                        <p className="mt-1 text-sm leading-snug text-muted">
                          {cash.description || 'Off any order'}
                        </p>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <PlateTag>Recent</PlateTag>
        {recent_activity?.length ? (
          <ul className="mt-3 space-y-2">
            {recent_activity.map((entry) => (
              <li
                key={`${entry.kind}-${entry.id}`}
                className="surface flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm text-cream-50">{formatActivity(entry)}</p>
                  <p className="text-xs text-muted">
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`font-semibold tabular-nums ${
                    entry.points >= 0 ? 'text-success' : 'text-gold-300'
                  }`}
                >
                  {entry.points >= 0 ? '+' : ''}
                  {entry.points}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3">
            <EmptyState title="No activity yet" body="Log an order to start earning." />
          </div>
        )}
      </section>

      <Modal
        open={!!pendingRedeem}
        onClose={() => !redeem.isPending && setPendingRedeem(null)}
        title="Confirm redemption"
      >
        {pendingRedeem && (
          <div className="space-y-5">
            <p className="text-cream-200">
              Redeem <span className="text-gold-300">{pendingRedeem.label}</span> for{' '}
              <span className="text-cream-50">{customer.name}</span>?
            </p>
            <p className="text-sm text-muted">
              This will use{' '}
              <span className="font-semibold text-gold-300">
                {pendingRedeem.reward.points_cost} points
              </span>
              .
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="btn-ghost flex-1 !min-h-12"
                disabled={redeem.isPending}
                onClick={() => setPendingRedeem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-gold flex-1 !min-h-12"
                disabled={redeem.isPending}
                onClick={confirmPendingRedeem}
              >
                {redeem.isPending ? 'Redeeming…' : 'Confirm redeem'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
