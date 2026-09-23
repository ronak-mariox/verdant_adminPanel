import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee,
  ShoppingBag,
  Activity,
  Receipt,
  Store,
  PackageCheck,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { CategoryRevenueChart } from '@/components/charts/CategoryRevenueChart';
import { ORDER_STATUS_META, type Order, type OrderStatus } from '@/types';
import { formatCurrency, timeAgo } from '@/lib/format';
import { api } from '@/lib/api';
import { mapOrder, type ApiCustomer, type ApiDriver, type ApiOrder, type ApiVendor, errorMessage } from '@/lib/adminOrders';

const STATUS_ORDER: OrderStatus[] = [
  'placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected',
];

const TERMINAL_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'rejected'];

interface ApiDashboard {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  last30Days: { revenue: number; orders: number };
  pendingVendorApprovals: number;
  pendingProductApprovals: number;
  totalCustomers: number;
  totalActiveVendors: number;
  recentOrders: ApiOrder[];
  revenueByCategory: { category: string; revenue: number }[];
}

export function Dashboard() {
  const [data, setData] = useState<ApiDashboard | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [dashboard, customers, vendors] = await Promise.all([
          api.get<ApiDashboard>('/admin/dashboard'),
          api.get<ApiCustomer[]>('/admin/customers'),
          api.get<ApiVendor[]>('/admin/vendors'),
        ]);
        if (cancelled) return;
        const customerById = new Map(customers.map((c) => [c.id, c]));
        const vendorById = new Map(vendors.map((v) => [v.id, v]));
        const driverById = new Map<string, ApiDriver>();
        setData(dashboard);
        setRecentOrders(dashboard.recentOrders.map((o) => mapOrder(o, customerById, vendorById, driverById)));
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load dashboard'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const activeOrders = useMemo(() => {
    if (!data) return 0;
    return STATUS_ORDER.filter((s) => !TERMINAL_STATUSES.includes(s)).reduce(
      (sum, s) => sum + (data.ordersByStatus[s] ?? 0),
      0,
    );
  }, [data]);

  const avgOrderValue = data && data.last30Days.orders > 0 ? Math.round(data.last30Days.revenue / data.last30Days.orders) : 0;
  const maxStatusCount = data ? Math.max(...STATUS_ORDER.map((s) => data.ordersByStatus[s] ?? 0), 1) : 1;
  const categoryRevenue = data ? data.revenueByCategory.map((c) => ({ name: c.category, value: c.revenue })) : [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Platform overview across orders, vendors, delivery partners and customers"
      />

      {loading ? (
        <Card>
          <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading dashboard…" />
        </Card>
      ) : loadError || !data ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle size={24} />}
            title="Couldn't load dashboard"
            description={loadError ?? undefined}
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Revenue (30d)"
              value={formatCurrency(data.last30Days.revenue)}
              icon={<IndianRupee size={18} />}
              iconColor="#1CA672"
              iconSurface="var(--color-brand-50)"
            />
            <StatCard
              label="Total orders"
              value={data.totalOrders}
              icon={<ShoppingBag size={18} />}
              iconColor="#3B82F6"
              iconSurface="var(--color-info-surface)"
            />
            <StatCard
              label="Active orders"
              value={activeOrders}
              icon={<Activity size={18} />}
              iconColor="#0891B2"
              iconSurface="var(--color-teal-surface)"
            />
            <StatCard
              label="Avg. order value (30d)"
              value={formatCurrency(avgOrderValue)}
              icon={<Receipt size={18} />}
              iconColor="#F79009"
              iconSurface="var(--color-warning-surface)"
            />
            <StatCard
              label="Active vendors"
              value={data.totalActiveVendors}
              icon={<Store size={18} />}
              iconColor="#7C3AED"
              iconSurface="var(--color-violet-surface)"
              trendLabel={`${data.pendingVendorApprovals} pending approval`}
            />
            <StatCard
              label="Pending products"
              value={data.pendingProductApprovals}
              icon={<PackageCheck size={18} />}
              iconColor="#4338CA"
              iconSurface="var(--color-indigo-surface)"
              trendLabel="awaiting review"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Revenue (last 30 days)" subtitle="No day-by-day trend endpoint yet — showing the aggregate figure" />
              <CardBody className="flex flex-col items-start justify-center gap-2 py-10">
                <p className="font-display text-4xl font-bold text-ink-900">{formatCurrency(data.last30Days.revenue)}</p>
                <p className="text-[13px] text-ink-500">across {data.last30Days.orders} non-cancelled orders in the last 30 days</p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Order pipeline" subtitle={`${data.totalOrders} orders total`} />
              <CardBody className="space-y-3">
                {STATUS_ORDER.map((status) => {
                  const count = data.ordersByStatus[status] ?? 0;
                  const meta = ORDER_STATUS_META[status];
                  return (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between text-[12.5px]">
                        <span className="font-medium text-ink-700">{meta.label}</span>
                        <span className="text-ink-500">{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(count / maxStatusCount) * 100}%`, backgroundColor: meta.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Revenue by category"
                subtitle="Which catalog categories drive the most sales"
              />
              <CardBody>
                {categoryRevenue.length === 0 ? (
                  <EmptyState icon={<Receipt size={20} />} title="No revenue yet" description="Revenue by category will appear once orders come in." />
                ) : (
                  <CategoryRevenueChart data={categoryRevenue} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Pending approvals" />
              <CardBody className="space-y-4">
                <Link to="/vendors" className="flex items-center justify-between rounded-xl border border-ink-200 px-4 py-3.5 hover:bg-ink-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-surface text-violet">
                      <Store size={16} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-ink-800">Vendor approvals</p>
                      <p className="text-[12px] text-ink-500">Awaiting review</p>
                    </div>
                  </div>
                  <span className="font-display text-lg font-bold text-ink-900">{data.pendingVendorApprovals}</span>
                </Link>
                <Link to="/products" className="flex items-center justify-between rounded-xl border border-ink-200 px-4 py-3.5 hover:bg-ink-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-surface text-indigo">
                      <PackageCheck size={16} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-ink-800">Product approvals</p>
                      <p className="text-[12px] text-ink-500">Awaiting review</p>
                    </div>
                  </div>
                  <span className="font-display text-lg font-bold text-ink-900">{data.pendingProductApprovals}</span>
                </Link>
                <div className="flex items-center justify-between rounded-xl border border-ink-200 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <ShoppingBag size={16} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-ink-800">Total customers</p>
                      <p className="text-[12px] text-ink-500">Registered on Verdant</p>
                    </div>
                  </div>
                  <span className="font-display text-lg font-bold text-ink-900">{data.totalCustomers}</span>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card className="mt-5">
            <CardHeader
              title="Recent orders"
              action={
                <Link to="/orders" className="flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:underline">
                  View all <ArrowRight size={13} />
                </Link>
              }
            />
            {recentOrders.length === 0 ? (
              <EmptyState icon={<ShoppingBag size={22} />} title="No orders yet" />
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Vendor</Th>
                    <Th>Status</Th>
                    <Th>Placed</Th>
                    <Th className="text-right">Total</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <Tr key={order.id}>
                      <Td>
                        <Link to={`/orders/${order.id}`} className="font-semibold text-ink-800 hover:text-brand-700">
                          {order.orderNumber ?? order.id}
                        </Link>
                      </Td>
                      <Td>{order.customerName}</Td>
                      <Td>{order.vendorName}</Td>
                      <Td>
                        <StatusBadge status={order.status} label={ORDER_STATUS_META[order.status].label} />
                      </Td>
                      <Td className="text-ink-500">{timeAgo(order.placedAt)}</Td>
                      <Td className="text-right font-semibold text-ink-800">{formatCurrency(order.total)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
