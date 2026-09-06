import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ErrorBanner, PlateTag, Spinner, SuccessBanner } from '../../components/ui';

function formatWhen(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function statusClass(status) {
  if (status === 'sent') return 'text-success';
  if (status === 'failed') return 'text-error';
  if (status === 'skipped') return 'text-muted';
  return 'text-gold-300';
}

function StatTile({ label, value, accent = 'text-cream-50' }) {
  return (
    <div className="surface p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`mt-2 font-display text-3xl tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function StatsPanel({ stats }) {
  const s = stats || {};
  const num = (v) => Number(v || 0).toLocaleString();
  const attempted = (s.sent || 0) + (s.failed || 0);
  const deliveryRate = attempted ? Math.round((s.sent / attempted) * 100) : null;

  return (
    <section className="mt-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="SMS sent (all time)" value={num(s.sent)} accent="text-gold-300" />
        <StatTile label="Sent this month" value={num(s.this_month_sent)} accent="text-gold-300" />
        <StatTile
          label="Failed"
          value={num(s.failed)}
          accent={s.failed ? 'text-error' : 'text-cream-50'}
        />
        <StatTile label="Order receipts" value={num(s.receipts_sent)} />
        <StatTile label="Reward texts" value={num(s.redemptions_sent)} />
        <StatTile label="Offers sent" value={num(s.promo_sent)} />
        <StatTile label="Campaigns run" value={num(s.campaigns_sent)} />
      </div>
      <p className="text-sm text-muted">
        {deliveryRate == null ? 'No messages sent yet.' : `${deliveryRate}% delivery rate`}
        {s.customers_reached ? ` · ${num(s.customers_reached)} customers reached by offers` : ''}
        {s.last_campaign_at ? ` · last campaign ${formatWhen(s.last_campaign_at)}` : ''}
        {s.skipped ? ` · ${num(s.skipped)} skipped (opted out / no credit)` : ''}
      </p>
    </section>
  );
}

export default function AdminMessages() {
  const queryClient = useQueryClient();
  const { staff } = useAuth();
  const canSend = staff?.role === 'platform_owner';
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);

  const statusQuery = useQuery({
    queryKey: ['admin-sms-status'],
    queryFn: async () => (await api.get('/admin/sms/status')).data,
    enabled: canSend,
  });

  const statsQuery = useQuery({
    queryKey: ['admin-sms-stats'],
    queryFn: async () => (await api.get('/admin/sms/stats')).data,
    enabled: !canSend,
  });

  const campaignsQuery = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: async () => (await api.get('/admin/campaigns')).data,
    refetchInterval: (query) =>
      query.state.data?.campaigns?.some((c) => c.status === 'sending') ? 2500 : false,
  });

  const logsQuery = useQuery({
    queryKey: ['admin-sms-logs'],
    queryFn: async () => (await api.get('/admin/sms/logs')).data,
  });

  useEffect(() => {
    if (!canSend) return undefined;
    let cancelled = false;
    async function loadPreview() {
      try {
        const { data } = await api.post('/admin/campaigns/preview', { body });
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setPreview(null);
      }
    }
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [body, canSend]);

  const sendTest = useMutation({
    mutationFn: async () =>
      (
        await api.post('/admin/sms/test', {
          phone: testPhone,
          message: testMessage,
        })
      ).data,
    onSuccess: (result) => {
      setMessage(
        result.log.status === 'skipped'
          ? `SMS skipped (${result.log.error || 'disabled'})`
          : `Test SMS ${result.log.status} to ${result.log.phone}`
      );
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-sms-logs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sms-status'] });
    },
    onError: (err) => {
      setMessage('');
      setError(getErrorMessage(err));
    },
  });

  const sendCampaign = useMutation({
    mutationFn: async () =>
      (
        await api.post('/admin/campaigns', {
          title,
          body,
        })
      ).data,
    onSuccess: (result) => {
      setMessage(`Sending to ${result.campaign.total} customers`);
      setError('');
      setTitle('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sms-logs'] });
    },
    onError: (err) => {
      setMessage('');
      setError(getErrorMessage(err));
    },
  });

  const status = statusQuery.data;
  const chars = body.length;
  const overLimit = chars > 621;

  return (
    <div>
      <PlateTag>{canSend ? 'Notify.lk' : 'Activity'}</PlateTag>
      <h1 className="mt-3 font-display text-4xl text-cream-50">Messages</h1>
      <p className="mt-2 text-muted">
        {canSend
          ? 'Order receipts go out automatically. Use this page to test Notify.lk and send offers to all members.'
          : 'Order receipts go out automatically. Below is a summary of every SMS sent to your customers — receipts and offers — with delivery results.'}
      </p>

      <div className="mt-4 space-y-2">
        <ErrorBanner message={error} />
        <SuccessBanner message={message} />
      </div>

      {canSend ? (
        statusQuery.isLoading ? (
          <Spinner />
        ) : (
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="surface p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Balance</p>
              <p className="mt-2 font-display text-3xl text-gold-300 tabular-nums">
                {status?.acc_balance == null ? '—' : Number(status.acc_balance).toLocaleString()}
              </p>
            </div>
            <div className="surface p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Sender ID</p>
              <p className="mt-2 font-display text-2xl text-cream-50">{status?.sender_id || '—'}</p>
            </div>
            <div className="surface p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Status</p>
              <p className="mt-2 text-cream-50">
                {status?.configured ? (status.enabled ? 'Ready' : 'Disabled') : 'Not configured'}
              </p>
              {status?.provider_error && (
                <p className="mt-1 text-xs text-error">{status.provider_error}</p>
              )}
            </div>
          </section>
        )
      ) : statsQuery.isLoading ? (
        <Spinner />
      ) : (
        <StatsPanel stats={statsQuery.data} />
      )}

      {canSend && (
      <form
        className="surface mt-6 space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          sendTest.mutate();
        }}
      >
        <h2 className="font-display text-2xl text-cream-50">Test SMS</h2>
        <p className="text-sm text-muted">Send one message to your phone before blasting customers.</p>
        <label className="block space-y-2">
          <span className="text-sm text-muted">Your mobile (07XXXXXXXX)</span>
          <input
            className="field"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="07XXXXXXXX"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-muted">Message (optional)</span>
          <input
            className="field"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Builders Brew test SMS…"
          />
        </label>
        <button className="btn-gold" type="submit" disabled={sendTest.isPending}>
          {sendTest.isPending ? 'Sending…' : 'Send test SMS'}
        </button>
      </form>
      )}

      {canSend && (
      <form
        className="surface mt-6 space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const count = preview?.recipient_count ?? 0;
          const ok = window.confirm(
            `Send this offer to ${count} customer${count === 1 ? '' : 's'}? This uses Notify.lk credit.`
          );
          if (ok) sendCampaign.mutate();
        }}
      >
        <h2 className="font-display text-2xl text-cream-50">Broadcast offer</h2>
        <label className="block space-y-2">
          <span className="text-sm text-muted">Internal title (optional)</span>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekend double points"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-muted">SMS to all customers</span>
          <textarea
            className="field min-h-32 py-3"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Builders Brew: Double points this weekend. New reward at 80 pts — show this SMS at the counter."
            required
          />
        </label>
        <p className={`text-sm ${overLimit ? 'text-error' : 'text-muted'}`}>
          {chars} / 621 chars
          {preview?.segments ? ` · ~${preview.segments} SMS segment${preview.segments === 1 ? '' : 's'}` : ''}
          {preview ? ` · ${preview.recipient_count} recipients` : ''}
        </p>
        <button
          className="btn-gold"
          type="submit"
          disabled={sendCampaign.isPending || !body.trim() || overLimit}
        >
          {sendCampaign.isPending ? 'Queuing…' : 'Send to all customers'}
        </button>
      </form>
      )}

      <section className="surface mt-6 p-5">
        <h2 className="font-display text-2xl text-cream-50">Campaigns</h2>
        {campaignsQuery.isLoading ? (
          <Spinner />
        ) : campaignsQuery.data?.campaigns?.length ? (
          <ul className="mt-4 space-y-3">
            {campaignsQuery.data.campaigns.map((c) => (
              <li key={c._id} className="border-t border-ink-700 pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-cream-50">{c.title}</p>
                  <p className={`text-sm ${statusClass(c.status)}`}>{c.status}</p>
                </div>
                <p className="mt-1 text-sm text-muted">{c.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {c.sent}/{c.total} sent · {c.failed} failed · {c.skipped} skipped ·{' '}
                  {formatWhen(c.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-muted">No broadcasts yet.</p>
        )}
      </section>

      <section className="surface mt-6 p-5">
        <h2 className="font-display text-2xl text-cream-50">Recent SMS</h2>
        {logsQuery.isLoading ? (
          <Spinner />
        ) : logsQuery.data?.logs?.length ? (
          <ul className="mt-4 space-y-3">
            {logsQuery.data.logs.map((log) => (
              <li key={log._id} className="border-t border-ink-700 pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-cream-50">
                    {log.customer_id?.name || log.phone} · {log.kind.replace('_', ' ')}
                  </p>
                  <p className={`text-sm ${statusClass(log.status)}`}>{log.status}</p>
                </div>
                <p className="mt-1 text-sm text-muted">{log.body}</p>
                {log.error ? <p className="mt-1 text-xs text-error">{log.error}</p> : null}
                <p className="mt-1 text-xs text-muted">{formatWhen(log.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-muted">No SMS logs yet. Send a test to your phone first.</p>
        )}
      </section>
    </div>
  );
}
