import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../lib/api';
import { ErrorBanner, LoadMoreButton, PlateTag, Spinner } from '../../components/ui';

const PAGE_SIZE = 10;
const EXPORT_LIMIT = 1000;

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  return x;
}

function endOfMonth(d) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  return x;
}

function presetRange(key) {
  const today = new Date();
  switch (key) {
    case 'today':
      return { from: toDateInput(today), to: toDateInput(today) };
    case 'week':
      return { from: toDateInput(startOfWeek(today)), to: toDateInput(today) };
    case 'month':
      return { from: toDateInput(startOfMonth(today)), to: toDateInput(today) };
    case 'last_month': {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { from: toDateInput(startOfMonth(lastMonth)), to: toDateInput(endOfMonth(lastMonth)) };
    }
    case 'all':
    default:
      return { from: '', to: '' };
  }
}

function fmtMoney(v) {
  return `Rs ${Number(v || 0).toLocaleString()}`;
}

function fmtDate(v) {
  return v ? new Date(v).toLocaleDateString() : '';
}

function fmtDateTime(v) {
  return v ? new Date(v).toLocaleString() : '';
}

function rangeLabel(from, to) {
  if (!from && !to) return 'All time';
  if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`;
  if (from) return `From ${fmtDate(from)}`;
  return `Up to ${fmtDate(to)}`;
}

function Stat({ label, value }) {
  return (
    <div className="surface p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl text-gold-300 tabular-nums">{value}</p>
    </div>
  );
}

function addPdfHeader(doc, title, subtitle) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Builders Brew', 14, 16);
  doc.setFontSize(12);
  doc.text(title, 14, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(subtitle, 14, 30);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 35);
  doc.setTextColor(0);
}

function finishPdf(doc, filename) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Page ${i} of ${pages}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' }
    );
  }
  doc.save(filename);
}

export default function AdminReports() {
  const [{ from, to }, setRange] = useState(presetRange('month'));
  const [preset, setPreset] = useState('month');
  const [printMode, setPrintMode] = useState(null);
  const [preparingPrint, setPreparingPrint] = useState(null); // 'activity' | 'customers' | null
  const [exporting, setExporting] = useState(null); // 'activity' | 'customers' | null

  const summaryQuery = useQuery({
    queryKey: ['admin-reports-summary', from, to],
    queryFn: async () =>
      (
        await api.get('/admin/reports/summary', {
          params: { from: from || undefined, to: to || undefined },
        })
      ).data,
  });

  const ordersQuery = useInfiniteQuery({
    queryKey: ['admin-reports-orders', from, to],
    queryFn: async ({ pageParam }) =>
      (
        await api.get('/admin/reports/orders', {
          params: { from: from || undefined, to: to || undefined, skip: pageParam, limit: PAGE_SIZE },
        })
      ).data,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.has_more ? pages.length * PAGE_SIZE : undefined),
  });
  const orders = ordersQuery.data?.pages.flatMap((p) => p.orders) || [];

  const redemptionsQuery = useInfiniteQuery({
    queryKey: ['admin-reports-redemptions', from, to],
    queryFn: async ({ pageParam }) =>
      (
        await api.get('/admin/reports/redemptions', {
          params: { from: from || undefined, to: to || undefined, skip: pageParam, limit: PAGE_SIZE },
        })
      ).data,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.has_more ? pages.length * PAGE_SIZE : undefined),
  });
  const redemptions = redemptionsQuery.data?.pages.flatMap((p) => p.redemptions) || [];

  const customersQuery = useInfiniteQuery({
    queryKey: ['admin-reports-customers'],
    queryFn: async ({ pageParam }) =>
      (await api.get('/admin/reports/customers', { params: { skip: pageParam, limit: PAGE_SIZE } })).data,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.has_more ? pages.length * PAGE_SIZE : undefined),
  });
  const customersList = customersQuery.data?.pages.flatMap((p) => p.customers) || [];

  useEffect(() => {
    if (!printMode) return;
    const timer = setTimeout(() => window.print(), 60);
    const onAfterPrint = () => setPrintMode(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printMode]);

  const label = useMemo(() => rangeLabel(from, to), [from, to]);

  function applyPreset(key) {
    setPreset(key);
    setRange(presetRange(key));
  }

  // Print/Download should cover the full range, not just what's loaded on
  // screen via "Load more" — so printing first pulls in every remaining page.
  async function loadAllPages(query) {
    let hasNextPage = query.hasNextPage;
    while (hasNextPage) {
      const result = await query.fetchNextPage();
      hasNextPage = result.hasNextPage;
    }
  }

  async function handlePrint(mode) {
    setPreparingPrint(mode);
    try {
      if (mode === 'activity') {
        await Promise.all([loadAllPages(ordersQuery), loadAllPages(redemptionsQuery)]);
      } else {
        await loadAllPages(customersQuery);
      }
      setPrintMode(mode);
    } finally {
      setPreparingPrint(null);
    }
  }

  // PDF/print exports always cover the full range, independent of how many
  // rows are currently loaded on screen via "Load more".
  async function fetchFullList(path, extraParams) {
    const { data } = await api.get(path, {
      params: { ...extraParams, skip: 0, limit: EXPORT_LIMIT },
    });
    return data;
  }

  async function exportActivityPdf() {
    if (!summaryQuery.data) return;
    setExporting('activity');
    try {
      const [ordersData, redemptionsData] = await Promise.all([
        fetchFullList('/admin/reports/orders', { from: from || undefined, to: to || undefined }),
        fetchFullList('/admin/reports/redemptions', { from: from || undefined, to: to || undefined }),
      ]);
      const { activity, top_rewards } = summaryQuery.data;

      const doc = new jsPDF();
      addPdfHeader(doc, 'Activity report', label);

      autoTable(doc, {
        startY: 40,
        theme: 'plain',
        styles: { fontSize: 9 },
        body: [
          ['Orders logged', activity.orders_logged, 'Revenue', fmtMoney(activity.revenue)],
          [
            'Points issued',
            activity.points_issued.toLocaleString(),
            'Points redeemed',
            activity.points_redeemed.toLocaleString(),
          ],
          [
            'Redemptions',
            activity.redemptions_count,
            'Avg order value',
            fmtMoney(activity.avg_order_value),
          ],
          ['New customers', activity.new_customers, 'Customers served', activity.unique_customers_served],
        ],
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
      });

      let nextY = doc.lastAutoTable.finalY + 10;

      if (top_rewards.length) {
        doc.setFontSize(11);
        doc.text('Top redeemed rewards', 14, nextY);
        autoTable(doc, {
          startY: nextY + 4,
          head: [['Reward', 'Times', 'Points']],
          body: top_rewards.map((r) => [r.name, r.count, r.points]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [40, 34, 26] },
        });
        nextY = doc.lastAutoTable.finalY + 10;
      }

      doc.setFontSize(11);
      doc.text('Orders logged', 14, nextY);
      autoTable(doc, {
        startY: nextY + 4,
        head: [['Date', 'Customer', 'Phone', 'Amount', 'Points', 'Order ref', 'Logged by']],
        body: ordersData.orders.map((o) => [
          fmtDateTime(o.created_at),
          o.customer_name,
          o.customer_phone,
          fmtMoney(o.amount_paid),
          o.points_earned,
          o.order_ref,
          o.staff_name,
        ]),
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [40, 34, 26] },
      });
      if (ordersData.has_more) {
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text(
          `List truncated — showing the most recent ${EXPORT_LIMIT} orders in range.`,
          14,
          doc.lastAutoTable.finalY + 5
        );
        doc.setTextColor(0);
      }

      nextY = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(11);
      doc.text('Redemptions', 14, nextY);
      autoTable(doc, {
        startY: nextY + 4,
        head: [['Date', 'Customer', 'Phone', 'Reward', 'Points', 'Code', 'Redeemed by']],
        body: redemptionsData.redemptions.map((r) => [
          fmtDateTime(r.created_at),
          r.customer_name,
          r.customer_phone,
          r.reward_name,
          r.points_spent,
          r.redemption_code,
          r.staff_name,
        ]),
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [40, 34, 26] },
      });
      if (redemptionsData.has_more) {
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text(
          `List truncated — showing the most recent ${EXPORT_LIMIT} redemptions in range.`,
          14,
          doc.lastAutoTable.finalY + 5
        );
        doc.setTextColor(0);
      }

      finishPdf(doc, `activity-report_${from || 'all'}_to_${to || 'now'}.pdf`);
    } finally {
      setExporting(null);
    }
  }

  async function exportCustomersPdf() {
    if (!summaryQuery.data) return;
    setExporting('customers');
    try {
      const customersData = await fetchFullList('/admin/reports/customers', {});
      const { customers } = summaryQuery.data;

      const doc = new jsPDF();
      addPdfHeader(doc, 'Customer details', `${customers.total_customers} members`);

      autoTable(doc, {
        startY: 40,
        theme: 'plain',
        styles: { fontSize: 9 },
        body: [
          ['Total customers', customers.total_customers],
          ['Points outstanding', customers.points_outstanding.toLocaleString()],
        ],
        columnStyles: { 0: { fontStyle: 'bold' } },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [
          ['Name', 'Phone', 'Joined', 'Balance', 'Lifetime earned', 'Lifetime redeemed', 'Orders', 'Spend'],
        ],
        body: customersData.customers.map((c) => [
          c.name,
          c.phone,
          fmtDate(c.created_at),
          c.points_available.toLocaleString(),
          c.lifetime_earned.toLocaleString(),
          c.lifetime_redeemed.toLocaleString(),
          c.orders_count,
          fmtMoney(c.total_spend),
        ]),
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [40, 34, 26] },
      });

      if (customersData.has_more) {
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text(
          `List truncated — showing the top ${EXPORT_LIMIT} customers.`,
          14,
          doc.lastAutoTable.finalY + 5
        );
        doc.setTextColor(0);
      }

      finishPdf(doc, `customer-details_${toDateInput(new Date())}.pdf`);
    } finally {
      setExporting(null);
    }
  }

  const loading = summaryQuery.isLoading || ordersQuery.isLoading || redemptionsQuery.isLoading;
  const summary = summaryQuery.data;

  return (
    <div>
      <PlateTag>Dashboard</PlateTag>
      <h1 className="mt-3 font-display text-4xl text-cream-50">Reports</h1>
      <p className="mt-2 text-muted">
        Export orders, redemptions, and the customer roster to hand to your client.
      </p>

      <div className="mt-4">
        <ErrorBanner message={summaryQuery.error ? 'Could not load report data.' : ''} />
      </div>

      <div className="surface mt-6 flex flex-col gap-4 p-5 print:hidden">
        <div className="flex flex-wrap gap-2">
          {[
            ['today', 'Today'],
            ['week', 'This week'],
            ['month', 'This month'],
            ['last_month', 'Last month'],
            ['all', 'All time'],
          ].map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                preset === key
                  ? 'bg-gold-500 text-ink-950'
                  : 'bg-ink-800 text-muted hover:text-cream-200'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-muted">From</span>
            <input
              className="field"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setPreset('custom');
                setRange((r) => ({ ...r, from: e.target.value }));
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted">To</span>
            <input
              className="field"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setPreset('custom');
                setRange((r) => ({ ...r, to: e.target.value }));
              }}
            />
          </label>
          {summaryQuery.isFetching && <span className="pb-2 text-sm text-muted">Refreshing…</span>}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        summary && (
          <>
            <section className={printMode && printMode !== 'activity' ? 'print:hidden' : ''}>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-cream-50">Activity report</h2>
                  <p className="text-sm text-muted">{label}</p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={preparingPrint === 'activity'}
                    onClick={() => handlePrint('activity')}
                  >
                    {preparingPrint === 'activity' ? 'Preparing…' : 'Print'}
                  </button>
                  <button
                    type="button"
                    className="btn-gold"
                    disabled={exporting === 'activity'}
                    onClick={exportActivityPdf}
                  >
                    {exporting === 'activity' ? 'Preparing…' : 'Download PDF'}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Orders logged" value={summary.activity.orders_logged.toLocaleString()} />
                <Stat label="Revenue" value={fmtMoney(summary.activity.revenue)} />
                <Stat label="Points issued" value={summary.activity.points_issued.toLocaleString()} />
                <Stat label="Points redeemed" value={summary.activity.points_redeemed.toLocaleString()} />
                <Stat label="Redemptions" value={summary.activity.redemptions_count.toLocaleString()} />
                <Stat label="New customers" value={summary.activity.new_customers.toLocaleString()} />
                <Stat
                  label="Customers served"
                  value={summary.activity.unique_customers_served.toLocaleString()}
                />
                <Stat label="Avg order value" value={fmtMoney(summary.activity.avg_order_value)} />
              </div>

              <section className="surface mt-6 p-5">
                <h3 className="font-display text-xl text-cream-50">Top redeemed rewards</h3>
                {summary.top_rewards.length ? (
                  <table className="mt-4 w-full text-left text-sm">
                    <thead className="text-muted">
                      <tr>
                        <th className="pb-2 font-medium">Reward</th>
                        <th className="pb-2 font-medium">Times</th>
                        <th className="pb-2 font-medium">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.top_rewards.map((r) => (
                        <tr key={r.reward_id} className="border-t border-ink-700">
                          <td className="py-2 text-cream-50">{r.name}</td>
                          <td className="py-2 tabular-nums">{r.count}</td>
                          <td className="py-2 tabular-nums text-gold-300">{r.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="mt-3 text-muted">No redemptions in this range.</p>
                )}
              </section>

              <section className="surface mt-6 overflow-x-auto p-5">
                <h3 className="font-display text-xl text-cream-50">Orders logged</h3>
                {orders.length ? (
                  <>
                    <table className="mt-4 w-full min-w-[720px] text-left text-sm">
                      <thead className="text-muted">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">Date</th>
                          <th className="pb-2 pr-3 font-medium">Customer</th>
                          <th className="pb-2 pr-3 font-medium">Amount</th>
                          <th className="pb-2 pr-3 font-medium">Points</th>
                          <th className="pb-2 pr-3 font-medium">Order ref</th>
                          <th className="pb-2 font-medium">Logged by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => (
                          <tr key={o.id} className="border-t border-ink-700">
                            <td className="py-2 pr-3 text-muted">{fmtDateTime(o.created_at)}</td>
                            <td className="py-2 pr-3 text-cream-50">
                              {o.customer_name}
                              <span className="block text-xs text-muted">{o.customer_phone}</span>
                            </td>
                            <td className="py-2 pr-3 tabular-nums">{fmtMoney(o.amount_paid)}</td>
                            <td className="py-2 pr-3 tabular-nums text-gold-300">{o.points_earned}</td>
                            <td className="py-2 pr-3 text-muted">{o.order_ref}</td>
                            <td className="py-2 text-cream-200">{o.staff_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <LoadMoreButton
                      className="mt-4 print:hidden"
                      hasMore={ordersQuery.hasNextPage}
                      isLoading={ordersQuery.isFetchingNextPage}
                      onClick={() => ordersQuery.fetchNextPage()}
                    />
                  </>
                ) : (
                  <p className="mt-3 text-muted">No orders logged in this range.</p>
                )}
              </section>

              <section className="surface mt-6 overflow-x-auto p-5">
                <h3 className="font-display text-xl text-cream-50">Redemptions</h3>
                {redemptions.length ? (
                  <>
                    <table className="mt-4 w-full min-w-[720px] text-left text-sm">
                      <thead className="text-muted">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">Date</th>
                          <th className="pb-2 pr-3 font-medium">Customer</th>
                          <th className="pb-2 pr-3 font-medium">Reward</th>
                          <th className="pb-2 pr-3 font-medium">Points</th>
                          <th className="pb-2 pr-3 font-medium">Code</th>
                          <th className="pb-2 font-medium">Redeemed by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {redemptions.map((r) => (
                          <tr key={r.id} className="border-t border-ink-700">
                            <td className="py-2 pr-3 text-muted">{fmtDateTime(r.created_at)}</td>
                            <td className="py-2 pr-3 text-cream-50">
                              {r.customer_name}
                              <span className="block text-xs text-muted">{r.customer_phone}</span>
                            </td>
                            <td className="py-2 pr-3 text-cream-200">{r.reward_name}</td>
                            <td className="py-2 pr-3 tabular-nums text-gold-300">{r.points_spent}</td>
                            <td className="py-2 pr-3 text-muted">{r.redemption_code}</td>
                            <td className="py-2 text-cream-200">{r.staff_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <LoadMoreButton
                      className="mt-4 print:hidden"
                      hasMore={redemptionsQuery.hasNextPage}
                      isLoading={redemptionsQuery.isFetchingNextPage}
                      onClick={() => redemptionsQuery.fetchNextPage()}
                    />
                  </>
                ) : (
                  <p className="mt-3 text-muted">No redemptions in this range.</p>
                )}
              </section>
            </section>

            <section className={printMode && printMode !== 'customers' ? 'print:hidden' : ''}>
              <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-cream-50">Customer details</h2>
                  <p className="text-sm text-muted">
                    Live roster · {summary.customers.total_customers.toLocaleString()} members
                  </p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={preparingPrint === 'customers'}
                    onClick={() => handlePrint('customers')}
                  >
                    {preparingPrint === 'customers' ? 'Preparing…' : 'Print'}
                  </button>
                  <button
                    type="button"
                    className="btn-gold"
                    disabled={exporting === 'customers'}
                    onClick={exportCustomersPdf}
                  >
                    {exporting === 'customers' ? 'Preparing…' : 'Download PDF'}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Stat
                  label="Total customers"
                  value={summary.customers.total_customers.toLocaleString()}
                />
                <Stat
                  label="Points outstanding"
                  value={summary.customers.points_outstanding.toLocaleString()}
                />
              </div>

              <section className="surface mt-6 overflow-x-auto p-5">
                {customersQuery.isLoading ? (
                  <Spinner />
                ) : customersList.length ? (
                  <>
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="text-muted">
                        <tr>
                          <th className="pb-2 pr-3 font-medium">Name</th>
                          <th className="pb-2 pr-3 font-medium">Phone</th>
                          <th className="pb-2 pr-3 font-medium">Joined</th>
                          <th className="pb-2 pr-3 font-medium">Balance</th>
                          <th className="pb-2 pr-3 font-medium">Lifetime earned</th>
                          <th className="pb-2 pr-3 font-medium">Lifetime redeemed</th>
                          <th className="pb-2 pr-3 font-medium">Orders</th>
                          <th className="pb-2 font-medium">Spend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customersList.map((c) => (
                          <tr key={c.id} className="border-t border-ink-700">
                            <td className="py-2 pr-3 text-cream-50">{c.name}</td>
                            <td className="py-2 pr-3 text-muted">{c.phone}</td>
                            <td className="py-2 pr-3 text-muted">{fmtDate(c.created_at)}</td>
                            <td className="py-2 pr-3 tabular-nums text-gold-300">
                              {c.points_available.toLocaleString()}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">{c.lifetime_earned.toLocaleString()}</td>
                            <td className="py-2 pr-3 tabular-nums">
                              {c.lifetime_redeemed.toLocaleString()}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">{c.orders_count}</td>
                            <td className="py-2 tabular-nums">{fmtMoney(c.total_spend)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <LoadMoreButton
                      className="mt-4 print:hidden"
                      hasMore={customersQuery.hasNextPage}
                      isLoading={customersQuery.isFetchingNextPage}
                      onClick={() => customersQuery.fetchNextPage()}
                    />
                  </>
                ) : (
                  <p className="text-muted">No customers yet.</p>
                )}
              </section>
            </section>
          </>
        )
      )}
    </div>
  );
}
