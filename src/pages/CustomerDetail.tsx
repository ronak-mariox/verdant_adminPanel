import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Clock,
  ShoppingBag,
  IndianRupee,
  Receipt,
  UserX,
  UserCheck,
  Users,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import type { Customer, CustomerStatus, Order } from '@/types';
import { ORDER_STATUS_META } from '@/types';
import { formatCurrency, formatDate, timeAgo } from '@/lib/format';
import { api, fetchAllPaginatedWithMeta, truncationMessage } from '@/lib/api';
import { mapOrder, errorMessage, type ApiDriver, type ApiOrder, type ApiVendor } from '@/lib/adminOrders';
import { avatarColorFor } from '@/lib/avatarColor';

interface ApiCustomer {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  status: CustomerStatus;
  createdAt: string;
}

function mapCustomer(c: ApiCustomer): Customer {
  return {
    id: c.id,
    name: c.name || c.phone,
    email: c.email ?? '—',
    phone: c.phone,
    avatarColor: avatarColorFor(c.id),
    status: c.status,
    joinedAt: c.createdAt,
  };
}

interface OrderStats {
  totalOrders: number;
  totalSpent: number;
  lastOrderAt?: string;
}

export function CustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();

  const [customerApi, setCustomerApi] = useState<ApiCustomer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats>({ totalOrders: 0, totalSpent: 0 });
  const [truncation, setTruncation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      setNotFound(false);
      try {
        const c = await api.get<ApiCustomer>(`/admin/customers/${customerId}`);
        const ordersRes = await fetchAllPaginatedWithMeta<ApiOrder>('/admin/orders', { customerId });
        const ordersRaw = ordersRes.items;

        const vendorIds = Array.from(new Set(ordersRaw.map((o) => o.vendorId)));
        const driverIds = Array.from(new Set(ordersRaw.map((o) => o.driverId).filter(Boolean))) as string[];
        const [vendors, drivers] = await Promise.all([
          vendorIds.length ? api.get<ApiVendor[]>('/admin/vendors') : Promise.resolve([] as ApiVendor[]),
          driverIds.length ? api.get<ApiDriver[]>('/admin/drivers') : Promise.resolve([] as ApiDriver[]),
        ]);
        if (cancelled) return;

        const customerById = new Map([[c.id, c]]);
        const vendorById = new Map(vendors.map((v) => [v.id, v]));
        const driverById = new Map(drivers.map((d) => [d.id, d]));

        const mappedOrders = ordersRaw
          .map((o) => mapOrder(o, customerById, vendorById, driverById))
          .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

        // Spend counts delivered orders only — cancelled/rejected orders aren't revenue.
        const totalSpent = mappedOrders.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);

        setCustomerApi(c);
        setCustomerOrders(mappedOrders);
        setOrderStats({
          totalOrders: ordersRes.total,
          totalSpent,
          lastOrderAt: mappedOrders[0]?.placedAt,
        });
        setTruncation(ordersRes.truncated ? truncationMessage(ordersRes.total, ordersRaw.length) : null);
      } catch (err) {
        if (cancelled) return;
        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
          setNotFound(true);
        } else {
          setLoadError(errorMessage(err, 'Failed to load customer'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [customerId, reloadKey]);

  const customer = customerApi ? mapCustomer(customerApi) : null;

  async function updateStatus(status: CustomerStatus) {
    if (!customerId) return;
    setActionError(null);
    setUpdating(true);
    try {
      const updated = await api.patch<ApiCustomer>(`/admin/customers/${customerId}/status`, { status });
      setCustomerApi(updated);
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update customer status'));
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Link to="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
          <ArrowLeft size={15} /> Back to customers
        </Link>
        <Card>
          <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading customer…" />
        </Card>
      </div>
    );
  }

  if (notFound || !customer) {
    return (
      <div>
        <Link to="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
          <ArrowLeft size={15} /> Back to customers
        </Link>
        <Card>
          {loadError ? (
            <EmptyState
              icon={<AlertTriangle size={24} />}
              title="Couldn't load customer"
              description={loadError}
              action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
            />
          ) : (
            <EmptyState
              icon={<Users size={24} />}
              title="Customer not found"
              description="This customer may have been removed or the link is incorrect."
              action={
                <Link to="/customers">
                  <Button variant="outline">Go to customers</Button>
                </Link>
              }
            />
          )}
        </Card>
      </div>
    );
  }

  const deliveredCount = customerOrders.filter((o) => o.status === 'delivered').length;
  const avgOrderValue = deliveredCount > 0 ? orderStats.totalSpent / deliveredCount : 0;

  return (
    <div>
      <Link to="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft size={15} /> Back to customers
      </Link>

      <PageHeader
        title={customer.name}
        subtitle="Customer"
        actions={
          customer.status === 'blocked' ? (
            <Button variant="primary" icon={<UserCheck size={16} />} onClick={() => updateStatus('active')} disabled={updating}>
              Unblock
            </Button>
          ) : (
            <Button variant="danger" icon={<UserX size={16} />} onClick={() => setConfirmOpen(true)} disabled={updating}>
              Block
            </Button>
          )
        }
      />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}
      {truncation && <InlineAlert tone="warning" message={truncation} className="mb-4" />}

      <Card>
        <CardBody className="flex flex-wrap items-start gap-6">
          <Avatar name={customer.name} color={customer.avatarColor} size={64} />
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-ink-900">{customer.name}</h2>
              <StatusBadge status={customer.status} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-2 text-[13px] text-ink-600">
                <Mail size={14} className="text-ink-400" /> {customer.email}
              </div>
              <div className="flex items-center gap-2 text-[13px] text-ink-600">
                <Phone size={14} className="text-ink-400" /> {customer.phone}
              </div>
              <div className="flex items-center gap-2 text-[13px] text-ink-600">
                <Calendar size={14} className="text-ink-400" /> Joined {formatDate(customer.joinedAt)}
              </div>
              <div className="flex items-center gap-2 text-[13px] text-ink-600">
                <Clock size={14} className="text-ink-400" /> Last order{' '}
                {orderStats.lastOrderAt ? timeAgo(orderStats.lastOrderAt) : '—'}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total orders"
          value={orderStats.totalOrders}
          icon={<ShoppingBag size={18} />}
          iconColor="#3B82F6"
          iconSurface="var(--color-info-surface)"
          trendLabel={`${deliveredCount} delivered`}
        />
        <StatCard
          label="Total spent (delivered)"
          value={formatCurrency(orderStats.totalSpent)}
          icon={<IndianRupee size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Avg order value"
          value={formatCurrency(avgOrderValue)}
          icon={<Receipt size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
      </div>

      <Card className="mt-5">
        <CardBody className="border-b border-ink-100 py-4">
          <h3 className="font-display text-[15px] font-semibold text-ink-900">Order history</h3>
        </CardBody>
        {customerOrders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={22} />}
            title="No orders yet"
            description="This customer hasn't placed any orders."
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Order</Th>
                <Th>Vendor</Th>
                <Th>Items</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                <Th>Placed</Th>
              </Tr>
            </Thead>
            <tbody>
              {customerOrders.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <Link to={`/orders/${o.id}`} className="font-semibold text-ink-800 hover:text-brand-700">
                      {o.orderNumber ?? o.id}
                    </Link>
                  </Td>
                  <Td>{o.vendorName}</Td>
                  <Td className="text-ink-600">{o.itemsCount}</Td>
                  <Td className="text-right font-semibold text-ink-800">{formatCurrency(o.total)}</Td>
                  <Td>
                    <StatusBadge status={o.status} label={ORDER_STATUS_META[o.status].label} />
                  </Td>
                  <Td className="text-ink-500">{formatDate(o.placedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Block this customer?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                updateStatus('blocked');
                setConfirmOpen(false);
              }}
            >
              Block customer
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          {customer.name} will no longer be able to place orders on Verdant until unblocked.
        </p>
      </Modal>
    </div>
  );
}
