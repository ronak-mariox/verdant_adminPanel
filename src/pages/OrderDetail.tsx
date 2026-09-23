import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Bike, ImageOff, Loader2, PackageX, Store, User } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Select } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { ORDER_STATUS_META, type Order, type OrderStatus } from '@/types';
import { formatCurrency, formatDateTime, timeAgo } from '@/lib/format';
import { api } from '@/lib/api';
import {
  mapOrder,
  vendorCity,
  type ApiCustomer,
  type ApiDriver,
  type ApiOrder,
  type ApiVendor,
  errorMessage,
} from '@/lib/adminOrders';
import { cn } from '@/lib/cn';

const ALL_STATUSES: OrderStatus[] = [
  'placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected',
];

const TERMINAL_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'rejected'];

export function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [vendor, setVendor] = useState<ApiVendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      setNotFound(false);
      try {
        const o = await api.get<ApiOrder>(`/admin/orders/${orderId}`);
        const [customer, vendorRecord] = await Promise.all([
          api.get<ApiCustomer>(`/admin/customers/${o.customerId}`),
          api.get<ApiVendor>(`/admin/vendors/${o.vendorId}`),
        ]);
        const driver = o.driverId ? await api.get<ApiDriver>(`/admin/drivers/${o.driverId}`) : undefined;
        if (cancelled) return;
        const customerById = new Map([[customer.id, customer]]);
        const vendorById = new Map([[vendorRecord.id, vendorRecord]]);
        const driverById = new Map(driver ? [[driver.id, driver] as const] : []);
        setOrder(mapOrder(o, customerById, vendorById, driverById));
        setVendor(vendorRecord);
      } catch (err) {
        if (cancelled) return;
        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
          setNotFound(true);
        } else {
          setLoadError(errorMessage(err, 'Failed to load order'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [orderId, reloadKey]);

  async function handleStatusChange(next: OrderStatus) {
    if (!order || next === order.status || !orderId) return;
    setStatusError(null);
    setUpdating(true);
    try {
      const updated = await api.patch<ApiOrder>(`/admin/orders/${orderId}/status`, { status: next });
      const customerById = new Map([[updated.customerId, { id: updated.customerId, phone: order.customerPhone, name: order.customerName }]]);
      const vendorById = new Map(vendor ? [[vendor.id, vendor] as const] : []);
      const driverById = new Map<string, ApiDriver>();
      setOrder((prev) =>
        prev
          ? {
              ...mapOrder(updated, customerById, vendorById, driverById),
              // keep the already-resolved display names instead of the placeholder maps above
              customerName: prev.customerName,
              customerPhone: prev.customerPhone,
              driverName: prev.driverName,
            }
          : prev,
      );
    } catch (err) {
      setStatusError(errorMessage(err, 'Failed to update order status'));
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Link to="/orders" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-700">
          <ArrowLeft size={16} /> Back to Orders
        </Link>
        <Card>
          <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading order…" />
        </Card>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div>
        <Link to="/orders" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-700">
          <ArrowLeft size={16} /> Back to Orders
        </Link>
        <Card>
          {loadError ? (
            <EmptyState
              icon={<AlertTriangle size={24} />}
              title="Couldn't load order"
              description={loadError}
              action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
            />
          ) : (
            <EmptyState
              icon={<PackageX size={24} />}
              title="Order not found"
              description="This order doesn't exist or may have been removed."
              action={
                <Link to="/orders">
                  <Button>Back to Orders</Button>
                </Link>
              }
            />
          )}
        </Card>
      </div>
    );
  }

  const isTerminal = TERMINAL_STATUSES.includes(order.status);
  const showDriver = !!order.driverId && !!order.driverName;

  return (
    <div>
      <Link to="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-700">
        <ArrowLeft size={16} /> Back to Orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-ink-900">{order.orderNumber ?? order.id}</h1>
            <StatusBadge status={order.status} label={ORDER_STATUS_META[order.status].label} />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Placed {formatDateTime(order.placedAt)} · {timeAgo(order.placedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-ink-500">Update status</span>
          <Select
            value={order.status}
            disabled={updating}
            onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {statusError && <InlineAlert message={statusError} className="mb-5" />}

      {isTerminal && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger-surface px-5 py-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-semibold text-danger">
              This order was {order.status === 'cancelled' ? 'cancelled' : order.status === 'rejected' ? 'rejected' : 'delivered'}
            </p>
            {order.status !== 'delivered' && (
              <p className="mt-0.5 text-[13px] text-ink-600">
                {order.cancelReason ?? 'No reason was recorded for this order.'}
              </p>
            )}
          </div>
        </div>
      )}

      <Card className="mb-5">
        <CardHeader title="Status timeline" subtitle="Progress of this order through the fulfilment pipeline" />
        <CardBody>
          <div className="flex flex-wrap gap-x-8 gap-y-5 overflow-x-auto pb-1">
            {order.statusHistory.map((event, i) => {
              const meta = ORDER_STATUS_META[event.status];
              const isLast = i === order.statusHistory.length - 1;
              return (
                <div key={`${event.status}-${event.time}-${i}`} className="flex min-w-[120px] items-start gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {i + 1}
                    </span>
                    {!isLast && <span className="mt-1 h-px w-10 bg-ink-200 sm:hidden" />}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-ink-800">{meta.label}</p>
                    <p className="text-[12px] text-ink-500">{formatDateTime(event.time)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Order items" subtitle={`${order.itemsCount} item${order.itemsCount === 1 ? '' : 's'}`} />
            <Table>
              <Thead>
                <Tr>
                  <Th>Item</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Total</Th>
                </Tr>
              </Thead>
              <tbody>
                {order.items.map((item, i) => (
                  <Tr key={`${item.productId}-${i}`}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-11 w-11 shrink-0 rounded-lg border border-ink-100 object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ink-100 bg-ink-100 text-ink-300">
                            <ImageOff size={16} />
                          </div>
                        )}
                        <span className="font-medium text-ink-800">{item.name}</span>
                      </div>
                    </Td>
                    <Td className="text-right text-ink-500">{item.qty}</Td>
                    <Td className="text-right text-ink-500">{formatCurrency(item.price)}</Td>
                    <Td className="text-right font-semibold text-ink-800">{formatCurrency(item.price * item.qty)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <div className="space-y-2 border-t border-ink-100 px-5 py-4 text-[13.5px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Subtotal</span>
                <span className="text-ink-700">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Delivery fee</span>
                <span className="text-ink-700">{order.deliveryFee === 0 ? 'Free' : formatCurrency(order.deliveryFee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Platform fee</span>
                <span className="text-ink-700">{formatCurrency(order.platformFee)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Discount</span>
                  <span className="text-success">-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-3 text-[15px]">
                <span className="font-semibold text-ink-900">Total</span>
                <span className="font-bold text-ink-900">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Customer" />
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={order.customerName} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-ink-800">{order.customerName}</p>
                  <p className="text-[12.5px] text-ink-500">{order.customerPhone}</p>
                </div>
              </div>
              <div className="border-t border-ink-100 pt-3">
                <p className="text-[12px] font-medium uppercase tracking-wide text-ink-400">Delivery address</p>
                <p className="mt-1 text-[13px] text-ink-700">{order.address}</p>
                <p className="text-[13px] text-ink-500">{order.city}</p>
              </div>
              <Link
                to={`/customers/${order.customerId}`}
                className={cn('inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:underline')}
              >
                <User size={13} /> View customer profile
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vendor" />
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={order.vendorName} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-ink-800">{order.vendorName}</p>
                  {vendor && <p className="text-[12.5px] text-ink-500">{vendorCity(vendor)}</p>}
                </div>
              </div>
              <Link
                to={`/vendors/${order.vendorId}`}
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:underline"
              >
                <Store size={13} /> View vendor profile
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Delivery partner" />
            <CardBody>
              {showDriver ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={order.driverName!} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-ink-800">{order.driverName}</p>
                      <p className="text-[12.5px] text-ink-500">Delivery partner</p>
                    </div>
                  </div>
                  <Link
                    to={`/drivers/${order.driverId}`}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:underline"
                  >
                    <Bike size={13} /> View driver profile
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 text-center">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
                    <Bike size={18} />
                  </div>
                  <p className="text-[13px] font-medium text-ink-700">Unassigned</p>
                  <p className="mt-0.5 text-[12px] text-ink-500">Not yet dispatched for delivery.</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
