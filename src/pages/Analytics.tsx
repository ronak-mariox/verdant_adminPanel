import { useEffect, useState } from 'react';
import { IndianRupee, ShoppingBag, Receipt, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Button } from '@/components/ui/Button';
import { RevenueTrendChart } from '@/components/charts/RevenueTrendChart';
import { CategoryRevenueChart } from '@/components/charts/CategoryRevenueChart';
import { api, fetchAllPaginatedWithMeta, fetchPage, FETCH_ALL_MAX_ITEMS, truncationMessage, unwrapList } from '@/lib/api';
import { errorMessage, vendorDisplayName, type ApiOrder, type ApiVendor } from '@/lib/adminOrders';
import type { ApiVendorSettlement } from '@/lib/adminSettlements';
import { formatCurrency } from '@/lib/format';

const LOW_STOCK_THRESHOLD = 5;
const DAYS = 30;
const PAGE_LIMIT = 100;

interface ApiDashboard {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  last30Days: { revenue: number; orders: number };
  revenueByCategory: { category: string; revenue: number }[];
}

interface ApiProduct {
  id: string;
  vendorId: string;
  name: string;
  variants: { stock: number; isPrimary?: boolean }[];
}

interface TrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

interface TopVendor {
  vendorId: string;
  name: string;
  orders: number;
  gross: number;
}

interface StockAlert {
  id: string;
  name: string;
  vendorName: string;
  stock: number;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Walks delivered orders newest-first (the endpoint sorts by createdAt desc) and
 * stops once past the 30-day window, matching the dashboard's createdAt-based KPI. */
async function fetchRecentDelivered(since: Date): Promise<{ orders: ApiOrder[]; truncated: boolean }> {
  const orders: ApiOrder[] = [];
  const maxPages = Math.ceil(FETCH_ALL_MAX_ITEMS / PAGE_LIMIT);
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchPage<ApiOrder>('/admin/orders', { status: 'delivered', page, limit: PAGE_LIMIT });
    const inWindow = res.items.filter((o) => new Date(o.createdAt) >= since);
    orders.push(...inWindow);
    if (inWindow.length < res.items.length || page >= (res.totalPages || 1)) return { orders, truncated: false };
  }
  return { orders, truncated: true };
}

function buildTrend(orders: ApiOrder[], windowStart: Date): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>();
  const order: string[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(windowStart);
    d.setDate(windowStart.getDate() + i);
    const key = dayKey(d);
    order.push(key);
    buckets.set(key, {
      date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: 0,
      orders: 0,
    });
  }
  for (const o of orders) {
    const bucket = buckets.get(dayKey(new Date(o.createdAt)));
    if (!bucket) continue;
    bucket.revenue += o.pricing.grandTotal;
    bucket.orders += 1;
  }
  return order.map((k) => buckets.get(k)!);
}

export function Analytics() {
  const [dashboard, setDashboard] = useState<ApiDashboard | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [topVendors, setTopVendors] = useState<TopVendor[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const windowStart = new Date();
        windowStart.setHours(0, 0, 0, 0);
        windowStart.setDate(windowStart.getDate() - (DAYS - 1));

        const [dash, delivered, settlements, products, vendorsRaw] = await Promise.all([
          api.get<ApiDashboard>('/admin/dashboard'),
          fetchRecentDelivered(windowStart),
          fetchAllPaginatedWithMeta<ApiVendorSettlement>('/admin/settlements/vendors'),
          fetchAllPaginatedWithMeta<ApiProduct>('/admin/products', { status: 'active' }),
          api.get<ApiVendor[] | { items: ApiVendor[] }>('/admin/vendors'),
        ]);
        if (cancelled) return;

        const vendorNameById = new Map(unwrapList(vendorsRaw).map((v) => [v.id, vendorDisplayName(v)]));

        const byVendor = new Map<string, TopVendor>();
        for (const s of settlements.items) {
          const row = byVendor.get(s.vendorId) ?? {
            vendorId: s.vendorId,
            name: s.vendorName ?? vendorNameById.get(s.vendorId) ?? 'Unknown vendor',
            orders: 0,
            gross: 0,
          };
          row.orders += 1;
          row.gross += s.grossAmount;
          byVendor.set(s.vendorId, row);
        }

        const alerts: StockAlert[] = [];
        for (const p of products.items) {
          const variant = p.variants.find((v) => v.isPrimary) ?? p.variants[0];
          const stock = variant?.stock ?? 0;
          if (stock <= LOW_STOCK_THRESHOLD) {
            alerts.push({ id: p.id, name: p.name, vendorName: vendorNameById.get(p.vendorId) ?? 'Unknown vendor', stock });
          }
        }
        alerts.sort((a, b) => a.stock - b.stock);

        const nextNotices: string[] = [];
        if (delivered.truncated) {
          nextNotices.push(`Revenue trend uses the most recent ${delivered.orders.length.toLocaleString('en-IN')} delivered orders only.`);
        }
        if (settlements.truncated) {
          nextNotices.push(`Top vendors: ${truncationMessage(settlements.total, settlements.items.length)}`);
        }
        if (products.truncated) {
          nextNotices.push(`Stock alerts: ${truncationMessage(products.total, products.items.length)}`);
        }

        setDashboard(dash);
        setTrend(buildTrend(delivered.orders, windowStart));
        setTopVendors([...byVendor.values()].sort((a, b) => b.gross - a.gross).slice(0, 7));
        setStockAlerts(alerts.slice(0, 10));
        setNotices(nextNotices);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load analytics'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (loading || loadError || !dashboard) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Deeper reporting across revenue, catalog and vendor performance" />
        <Card>
          {loading ? (
            <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading analytics…" />
          ) : (
            <EmptyState
              icon={<AlertTriangle size={24} />}
              title="Couldn't load analytics"
              description={loadError ?? undefined}
              action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
            />
          )}
        </Card>
      </div>
    );
  }

  const { last30Days, ordersByStatus, totalOrders } = dashboard;
  const avgOrderValue = last30Days.orders > 0 ? Math.round(last30Days.revenue / last30Days.orders) : 0;
  const cancelled = (ordersByStatus.cancelled ?? 0) + (ordersByStatus.rejected ?? 0);
  const cancellationRate = totalOrders > 0 ? ((cancelled / totalOrders) * 100).toFixed(1) : '0.0';
  const categoryRevenue = dashboard.revenueByCategory.map((c) => ({ name: c.category, value: c.revenue }));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Deeper reporting across revenue, catalog and vendor performance" />

      {notices.map((n) => (
        <InlineAlert key={n} tone="warning" message={n} className="mb-4" />
      ))}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Delivered revenue (30d)"
          value={formatCurrency(last30Days.revenue)}
          icon={<IndianRupee size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Delivered orders (30d)"
          value={last30Days.orders}
          icon={<ShoppingBag size={18} />}
          iconColor="#3B82F6"
          iconSurface="var(--color-info-surface)"
        />
        <StatCard
          label="Avg. order value (30d)"
          value={formatCurrency(avgOrderValue)}
          icon={<Receipt size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
        <StatCard
          label="Cancelled / rejected"
          value={`${cancellationRate}%`}
          icon={<XCircle size={18} />}
          iconColor="#DC2626"
          iconSurface="var(--color-danger-surface)"
          trendLabel={`of ${totalOrders.toLocaleString('en-IN')} orders, all time`}
        />
      </div>

      <Card className="mt-6">
        <CardHeader title="Revenue trend" subtitle="Last 30 days, delivered orders by order date" />
        <CardBody className="pl-0 pr-4">
          <RevenueTrendChart data={trend} />
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Revenue by category" subtitle="Delivered item revenue, all time (top 8 categories)" />
        <CardBody>
          {categoryRevenue.length === 0 ? (
            <p className="text-sm text-ink-500">No delivered revenue yet.</p>
          ) : (
            <CategoryRevenueChart data={categoryRevenue} />
          )}
        </CardBody>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Top vendors" subtitle="By gross settled sales (delivered orders)" />
          {topVendors.length === 0 ? (
            <CardBody className="text-sm text-ink-500">No settled orders yet.</CardBody>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Vendor</Th>
                  <Th className="text-right">Orders</Th>
                  <Th className="text-right">Gross sales</Th>
                </Tr>
              </Thead>
              <tbody>
                {topVendors.map((v) => (
                  <Tr key={v.vendorId}>
                    <Td className="font-semibold text-ink-800">{v.name}</Td>
                    <Td className="text-right">{v.orders.toLocaleString('en-IN')}</Td>
                    <Td className="text-right font-medium text-ink-700">{formatCurrency(v.gross)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Stock alerts" subtitle={`Active products with ${LOW_STOCK_THRESHOLD} or fewer units in stock`} />
          {stockAlerts.length === 0 ? (
            <CardBody className="text-sm text-ink-500">No stock alerts right now.</CardBody>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Product</Th>
                  <Th>Vendor</Th>
                  <Th className="text-right">Stock</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <tbody>
                {stockAlerts.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-semibold text-ink-800">{p.name}</Td>
                    <Td className="text-ink-500">{p.vendorName}</Td>
                    <Td className="text-right">{p.stock}</Td>
                    <Td>
                      <StatusBadge status={p.stock <= 0 ? 'out-of-stock' : 'low-stock'} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
