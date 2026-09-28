import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, IndianRupee, Loader2, PackageSearch, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { ORDER_STATUS_META, TERMINAL_ORDER_STATUSES, type Order, type OrderStatus } from '@/types';
import { formatCurrency, timeAgo } from '@/lib/format';
import { api, fetchAllPaginatedWithMeta, fetchPage, truncationMessage } from '@/lib/api';
import { useDebounce } from '@/lib/useDebounce';
import { mapOrder, type ApiCustomer, type ApiDriver, type ApiOrder, type ApiVendor, errorMessage } from '@/lib/adminOrders';

const STATUS_ORDER: OrderStatus[] = [
  'placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected',
];

const PAGE_SIZE = 15;

interface ApiDashboardCounts {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  last30Days: { revenue: number; orders: number };
}

interface Lookups {
  customerById: Map<string, ApiCustomer>;
  vendorById: Map<string, ApiVendor>;
  driverById: Map<string, ApiDriver>;
}

function matchesSearch(o: Order, q: string): boolean {
  return `${o.orderNumber ?? ''} ${o.id} ${o.customerName} ${o.customerPhone} ${o.vendorName}`.toLowerCase().includes(q);
}

export function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') as OrderStatus | null) ?? 'all';
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const debouncedSearch = useDebounce(search.trim().toLowerCase(), 300);

  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [counts, setCounts] = useState<ApiDashboardCounts | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Names are resolved client-side (orders carry only ids), so the directories
  // are loaded once and reused across page/filter changes.
  useEffect(() => {
    let cancelled = false;
    async function loadLookups() {
      setLoadError(null);
      try {
        const [customers, vendors, drivers, dashboard] = await Promise.all([
          api.get<ApiCustomer[]>('/admin/customers'),
          api.get<ApiVendor[]>('/admin/vendors'),
          api.get<ApiDriver[]>('/admin/drivers'),
          api.get<ApiDashboardCounts>('/admin/dashboard'),
        ]);
        if (cancelled) return;
        setLookups({
          customerById: new Map(customers.map((c) => [c.id, c])),
          vendorById: new Map(vendors.map((v) => [v.id, v])),
          driverById: new Map(drivers.map((d) => [d.id, d])),
        });
        setCounts(dashboard);
      } catch (err) {
        if (!cancelled) {
          setLoadError(errorMessage(err, 'Failed to load orders'));
          setLoading(false);
        }
      }
    }
    loadLookups();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!lookups) return;
    let cancelled = false;
    async function loadOrders() {
      setLoading(true);
      setLoadError(null);
      try {
        const status = statusFilter === 'all' ? undefined : statusFilter;
        if (debouncedSearch) {
          // No server-side search on /admin/orders — pull every page for this
          // status (capped) and match order number / customer / vendor locally.
          const res = await fetchAllPaginatedWithMeta<ApiOrder>('/admin/orders', { status });
          if (cancelled) return;
          const mapped = res.items.map((o) => mapOrder(o, lookups!.customerById, lookups!.vendorById, lookups!.driverById));
          const matched = mapped.filter((o) => matchesSearch(o, debouncedSearch));
          setOrders(matched);
          setTotal(matched.length);
          setTruncated(res.truncated);
        } else {
          const res = await fetchPage<ApiOrder>('/admin/orders', { status, page, limit: PAGE_SIZE });
          if (cancelled) return;
          setOrders(res.items.map((o) => mapOrder(o, lookups!.customerById, lookups!.vendorById, lookups!.driverById)));
          setTotal(res.total);
          setTruncated(false);
        }
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load orders'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadOrders();
    return () => {
      cancelled = true;
    };
  }, [lookups, statusFilter, debouncedSearch, page]);

  const stats = useMemo(() => {
    const byStatus = counts?.ordersByStatus ?? {};
    const active = STATUS_ORDER.filter((s) => !TERMINAL_ORDER_STATUSES.includes(s)).reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);
    return {
      active,
      completed: byStatus.delivered ?? 0,
      cancelledFailed: (byStatus.cancelled ?? 0) + (byStatus.rejected ?? 0),
      revenue30d: counts?.last30Days.revenue ?? 0,
    };
  }, [counts]);

  const tabItems: TabItem[] = useMemo(
    () => [
      { value: 'all', label: 'All', count: counts?.totalOrders },
      ...STATUS_ORDER.map((status) => ({
        value: status,
        label: ORDER_STATUS_META[status].label,
        count: counts?.ordersByStatus[status] ?? 0,
      })),
    ],
    [counts],
  );

  function updateParams(next: { status?: string; search?: string; page?: number }) {
    const params = new URLSearchParams(searchParams);
    if (next.status !== undefined) {
      if (next.status === 'all') params.delete('status');
      else params.set('status', next.status);
    }
    if (next.search !== undefined) {
      if (next.search) params.set('search', next.search);
      else params.delete('search');
    }
    if (next.page !== undefined && next.page > 1) params.set('page', String(next.page));
    else params.delete('page');
    setSearchParams(params, { replace: true });
  }

  const isSearching = debouncedSearch.length > 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageOrders = isSearching ? orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : orders;

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={counts ? `${counts.totalOrders.toLocaleString('en-IN')} orders across the platform` : 'All orders across the platform'}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Active orders"
          value={stats.active}
          icon={<Activity size={18} />}
          iconColor="#0891B2"
          iconSurface="var(--color-teal-surface)"
        />
        <StatCard
          label="Delivered"
          value={stats.completed}
          icon={<CheckCircle2 size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Cancelled / rejected"
          value={stats.cancelledFailed}
          icon={<XCircle size={18} />}
          iconColor="#E11D48"
          iconSurface="var(--color-danger-surface)"
        />
        <StatCard
          label="Delivered revenue (30d)"
          value={formatCurrency(stats.revenue30d)}
          icon={<IndianRupee size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
      </div>

      <div className="mt-5 overflow-x-auto pb-1">
        <Tabs items={tabItems} value={statusFilter} onChange={(v) => updateParams({ status: v, page: 1 })} />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-4">
          <SearchInput
            placeholder="Search by order number, customer or vendor…"
            value={search}
            onChange={(e) => updateParams({ search: e.target.value, page: 1 })}
            className="w-full max-w-sm"
          />
        </div>

        {truncated && (
          <InlineAlert tone="warning" message={truncationMessage(total, orders.length)} className="mx-5 mt-4" />
        )}

        {loading ? (
          <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading orders…" />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle size={24} />}
            title="Couldn't load orders"
            description={loadError}
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        ) : pageOrders.length === 0 ? (
          <EmptyState
            icon={<PackageSearch size={24} />}
            title="No orders found"
            description="Try adjusting your search or filters to find what you're looking for."
          />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Vendor</Th>
                  <Th>Items</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                  <Th>Placed</Th>
                  <Th className="text-right">Total</Th>
                </Tr>
              </Thead>
              <tbody>
                {pageOrders.map((order) => (
                  <Tr key={order.id}>
                    <Td>
                      <Link to={`/orders/${order.id}`} className="font-semibold text-ink-800 hover:text-brand-700">
                        {order.orderNumber ?? order.id}
                      </Link>
                    </Td>
                    <Td>
                      <p className="font-medium text-ink-800">{order.customerName}</p>
                      <p className="text-[12px] text-ink-500">{order.customerPhone}</p>
                    </Td>
                    <Td>{order.vendorName}</Td>
                    <Td className="text-ink-500">{order.itemsCount}</Td>
                    <Td>
                      <p className="text-[13px] text-ink-700">{order.paymentMethod}</p>
                      <StatusBadge status={order.paymentStatus} />
                    </Td>
                    <Td>
                      <StatusBadge status={order.status} label={ORDER_STATUS_META[order.status].label} />
                    </Td>
                    <Td className="text-ink-500">{timeAgo(order.placedAt)}</Td>
                    <Td className="text-right font-semibold text-ink-800">{formatCurrency(order.total)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onChange={(p) => updateParams({ page: p })}
              total={total}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </Card>
    </div>
  );
}
