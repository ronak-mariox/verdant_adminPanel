import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, IndianRupee, Loader2, PackageSearch, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { SearchInput, Select } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ORDER_STATUS_META, type Order, type OrderStatus } from '@/types';
import { formatCurrency, timeAgo } from '@/lib/format';
import { api, fetchAllPaginated } from '@/lib/api';
import { mapOrder, type ApiCustomer, type ApiDriver, type ApiOrder, type ApiVendor, errorMessage } from '@/lib/adminOrders';

const STATUS_ORDER: OrderStatus[] = [
  'placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected',
];

const TERMINAL_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'rejected'];

const PAGE_SIZE = 15;

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [apiOrders, customers, vendors] = await Promise.all([
          fetchAllPaginated<ApiOrder>('/admin/orders'),
          api.get<ApiCustomer[]>('/admin/customers'),
          api.get<ApiVendor[]>('/admin/vendors'),
        ]);
        const driverIds = Array.from(new Set(apiOrders.map((o) => o.driverId).filter(Boolean))) as string[];
        const drivers = driverIds.length ? await api.get<ApiDriver[]>('/admin/drivers') : [];
        if (cancelled) return;

        const customerById = new Map(customers.map((c) => [c.id, c]));
        const vendorById = new Map(vendors.map((v) => [v.id, v]));
        const driverById = new Map(drivers.map((d) => [d.id, d]));

        setOrders(apiOrders.map((o) => mapOrder(o, customerById, vendorById, driverById)));
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load orders'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const cities = useMemo(
    () => Array.from(new Set(orders.map((o) => o.city).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [orders],
  );

  const stats = useMemo(() => {
    const active = orders.filter((o) => !TERMINAL_STATUSES.includes(o.status)).length;
    const completed = orders.filter((o) => o.status === 'delivered').length;
    const cancelledFailed = orders.filter((o) => o.status === 'cancelled' || o.status === 'rejected').length;
    const totalValue = orders.reduce((sum, o) => sum + o.total, 0);
    return { active, completed, cancelledFailed, totalValue };
  }, [orders]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return counts;
  }, [orders]);

  const tabItems: TabItem[] = useMemo(
    () => [
      { value: 'all', label: 'All', count: orders.length },
      ...STATUS_ORDER.map((status) => ({
        value: status,
        label: ORDER_STATUS_META[status].label,
        count: statusCounts[status] ?? 0,
      })),
    ],
    [orders.length, statusCounts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (cityFilter !== 'all' && o.city !== cityFilter) return false;
      if (q) {
        const haystack = `${o.id} ${o.customerName} ${o.vendorName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, cityFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageOrders = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateStatusFilter(value: string) {
    setStatusFilter(value as 'all' | OrderStatus);
    setPage(1);
  }

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateCityFilter(value: string) {
    setCityFilter(value);
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={`${orders.length} orders live across the platform`}
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
          label="Completed"
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
          label="Total order value"
          value={formatCurrency(stats.totalValue)}
          icon={<IndianRupee size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
      </div>

      <div className="mt-5 overflow-x-auto pb-1">
        <Tabs items={tabItems} value={statusFilter} onChange={updateStatusFilter} />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-4">
          <SearchInput
            placeholder="Search by order id, customer or vendor…"
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={cityFilter} onChange={(e) => updateCityFilter(e.target.value)}>
            <option value="all">All cities</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
        </div>

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
              onChange={setPage}
              total={filtered.length}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </Card>
    </div>
  );
}
