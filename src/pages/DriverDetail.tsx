import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bike,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Package,
  CheckCircle2,
  XCircle,
  IndianRupee,
  ShieldOff,
  UserCheck,
  Loader2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { ReasonModal } from '@/components/ui/ReasonModal';
import { mapDriverPayout, type ApiDriverPayout } from '@/lib/adminSettlements';
import type { Driver, DriverPayoutSummary, DriverStatus, KycStatus, Order } from '@/types';
import { ORDER_STATUS_META } from '@/types';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { api, fetchAllPaginatedWithMeta, truncationMessage, unwrapList } from '@/lib/api';
import {
  mapOrder,
  errorMessage,
  type ApiCustomer,
  type ApiDriver as ApiDriverBase,
  type ApiOrder,
  type ApiVendor,
} from '@/lib/adminOrders';
import { avatarColorFor } from '@/lib/avatarColor';
import { resolveAssetUrl } from '@/lib/asset';
import {
  DriverApplication,
  reviewCounts,
  type DriverApplicationData,
  type DriverReviewKey,
} from '@/components/drivers/DriverApplication';

type ApiDriver = ApiDriverBase &
  Omit<DriverApplicationData, 'phone' | 'fullName' | 'vehicleType'> & {
    status: DriverStatus;
    kycStatus: KycStatus;
    registrationStep?: string;
    rejectionReason?: string;
    vehicleType?: 'motorbike' | 'scooter' | 'bicycle' | 'other';
    createdAt: string;
  };

type DetailTab = 'application' | 'deliveries' | 'payouts';

function mapDriver(d: ApiDriver): Driver {
  return {
    id: d.id,
    name: d.fullName || d.phone,
    phone: d.phone,
    email: d.email ?? '—',
    avatarColor: avatarColorFor(d.id),
    vehicleType: d.vehicleType ?? 'other',
    vehicleNumber: d.vehicleDetails?.registrationNumber ?? '—',
    zone: d.address?.city ?? '—',
    status: d.status,
    kycStatus: d.kycStatus,
    registrationStep: d.registrationStep ?? '',
    rejectionReason: d.rejectionReason,
    joinedAt: d.createdAt,
  };
}

interface DeliveryStats {
  assigned: number;
  delivered: number;
  completionRate: number;
}

export function DriverDetail() {
  const { driverId } = useParams<{ driverId: string }>();

  const [driverApi, setDriverApi] = useState<ApiDriver | null>(null);
  const [driverOrders, setDriverOrders] = useState<Order[]>([]);
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats>({ assigned: 0, delivered: 0, completionRate: 0 });
  const [truncation, setTruncation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('application');
  const [payout, setPayout] = useState<DriverPayoutSummary | null>(null);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      setNotFound(false);
      try {
        const d = await api.get<ApiDriver>(`/admin/drivers/${driverId}`);
        const [ordersRes, payouts] = await Promise.all([
          fetchAllPaginatedWithMeta<ApiOrder>('/admin/orders', { driverId }),
          api.get<ApiDriverPayout[] | { items: ApiDriverPayout[] }>('/admin/settlements/drivers'),
        ]);
        const ordersRaw = ordersRes.items;
        const customerIds = Array.from(new Set(ordersRaw.map((o) => o.customerId)));
        const vendorIds = Array.from(new Set(ordersRaw.map((o) => o.vendorId)));
        const [customers, vendors] = await Promise.all([
          customerIds.length ? api.get<ApiCustomer[]>('/admin/customers') : Promise.resolve([] as ApiCustomer[]),
          vendorIds.length ? api.get<ApiVendor[]>('/admin/vendors') : Promise.resolve([] as ApiVendor[]),
        ]);
        if (cancelled) return;

        const customerById = new Map(customers.map((c) => [c.id, c]));
        const vendorById = new Map(vendors.map((v) => [v.id, v]));
        const driverById = new Map([[d.id, d]]);

        const delivered = ordersRaw.filter((o) => o.status === 'delivered').length;
        const completionRate = ordersRaw.length > 0 ? Math.round((delivered / ordersRaw.length) * 100) : 0;

        setDriverApi(d);
        setDriverOrders(ordersRaw.map((o) => mapOrder(o, customerById, vendorById, driverById)));
        setDeliveryStats({ assigned: ordersRes.total, delivered, completionRate });
        setTruncation(ordersRes.truncated ? truncationMessage(ordersRes.total, ordersRaw.length) : null);
        const driverPayout = unwrapList(payouts).map(mapDriverPayout).find((p) => p.driverId === driverId);
        setPayout(driverPayout ?? null);
      } catch (err) {
        if (cancelled) return;
        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
          setNotFound(true);
        } else {
          setLoadError(errorMessage(err, 'Failed to load driver'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [driverId, reloadKey]);

  const driver = driverApi ? mapDriver(driverApi) : null;

  async function updateStatus(status: DriverStatus, rejectionReason?: string) {
    if (!driverId) return;
    setActionError(null);
    setUpdating(true);
    try {
      const updated = await api.patch<ApiDriver>(`/admin/drivers/${driverId}/status`, {
        status,
        ...(rejectionReason ? { rejectionReason } : {}),
      });
      setDriverApi(updated);
      setRejectOpen(false);
      setConfirmOpen(false);
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update driver status'));
    } finally {
      setUpdating(false);
    }
  }

  async function reviewItem(key: DriverReviewKey, status: 'pending' | 'verified' | 'rejected', note?: string) {
    if (!driverId) return;
    setActionError(null);
    try {
      const updated = await api.patch<ApiDriver>(`/admin/drivers/${driverId}/reviews/${key}`, {
        status,
        ...(note ? { note } : {}),
      });
      setDriverApi(updated);
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to save the review'));
    }
  }

  if (loading) {
    return (
      <div>
        <Link to="/drivers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
          <ArrowLeft size={15} /> Back to delivery partners
        </Link>
        <Card>
          <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading delivery partner…" />
        </Card>
      </div>
    );
  }

  if (notFound || !driver) {
    return (
      <div>
        <Link to="/drivers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
          <ArrowLeft size={15} /> Back to delivery partners
        </Link>
        <Card>
          {loadError ? (
            <EmptyState
              icon={<AlertTriangle size={24} />}
              title="Couldn't load delivery partner"
              description={loadError}
              action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
            />
          ) : (
            <EmptyState
              icon={<Bike size={24} />}
              title="Delivery partner not found"
              description="This driver may have been removed or the link is incorrect."
              action={
                <Link to="/drivers">
                  <Button variant="outline">Go to delivery partners</Button>
                </Link>
              }
            />
          )}
        </Card>
      </div>
    );
  }

  const tabItems: TabItem[] = [
    { value: 'application', label: 'Application & KYC' },
    { value: 'deliveries', label: 'Assigned orders', count: driverOrders.length },
    { value: 'payouts', label: 'Payouts', count: payout ? 1 : 0 },
  ];

  const isSubmitted = driver.registrationStep === 'submitted';
  const review = reviewCounts(driverApi?.reviews);

  return (
    <div>
      <Link to="/drivers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft size={15} /> Back to delivery partners
      </Link>

      <PageHeader
        title={driver.name}
        subtitle={`Delivery partner · ${driver.zone}`}
        actions={
          driver.status === 'pending' ? (
            isSubmitted ? (
              <div className="flex items-center gap-2">
                <span title={review.rejected > 0 ? 'Resolve or undo the rejected items before approving' : undefined}>
                  <Button
                    variant="primary"
                    icon={<CheckCircle2 size={16} />}
                    onClick={() => updateStatus('active')}
                    disabled={updating || review.rejected > 0}
                  >
                    Approve
                  </Button>
                </span>
                <Button
                  variant="danger"
                  icon={<XCircle size={16} />}
                  onClick={() => (review.rejected > 0 ? updateStatus('rejected') : setRejectOpen(true))}
                  disabled={updating}
                >
                  {review.rejected > 0 ? `Send back (${review.rejected} to fix)` : 'Reject'}
                </Button>
              </div>
            ) : (
              <span className="rounded-lg bg-ink-100 px-3 py-2 text-[13px] text-ink-500">
                Registration in progress{driver.registrationStep ? ` · step: ${driver.registrationStep}` : ''}
              </span>
            )
          ) : driver.status === 'suspended' ? (
            <Button variant="primary" icon={<UserCheck size={16} />} onClick={() => updateStatus('active')} disabled={updating}>
              Reactivate
            </Button>
          ) : driver.status === 'active' ? (
            <Button variant="danger" icon={<ShieldOff size={16} />} onClick={() => setConfirmOpen(true)} disabled={updating}>
              Suspend
            </Button>
          ) : undefined
        }
      />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}
      {truncation && <InlineAlert tone="warning" message={truncation} className="mb-4" />}

      <Card>
        <CardBody className="flex flex-wrap items-start gap-6">
          {driverApi?.avatarUrl ? (
            <img
              src={resolveAssetUrl(driverApi.avatarUrl)}
              alt={driver.name}
              className="h-16 w-16 shrink-0 rounded-full border border-ink-200 object-cover"
            />
          ) : (
            <Avatar name={driver.name} color={driver.avatarColor} size={64} />
          )}
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-ink-900">{driver.name}</h2>
              <StatusBadge status={driver.status} />
              <StatusBadge status={driver.kycStatus} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-2 text-[13px] text-ink-600">
                <Phone size={14} className="text-ink-400" /> {driver.phone}
              </div>
              <div className="flex items-center gap-2 text-[13px] text-ink-600">
                <Mail size={14} className="text-ink-400" /> {driver.email}
              </div>
              <div className="flex items-center gap-2 text-[13px] text-ink-600">
                <MapPin size={14} className="text-ink-400" /> {driver.zone}
              </div>
              <div className="flex items-center gap-2 text-[13px] text-ink-600">
                <Bike size={14} className="text-ink-400" />
                <span className="capitalize">{driver.vehicleType}</span> · {driver.vehicleNumber}
              </div>
              <div className="flex items-center gap-2 text-[13px] text-ink-600">
                <Calendar size={14} className="text-ink-400" /> Joined {formatDate(driver.joinedAt)}
              </div>
            </div>
            {driver.status === 'rejected' && driver.rejectionReason && (
              <p className="mt-3 rounded-lg bg-danger-surface px-3 py-2 text-[13px] text-danger">Rejected: {driver.rejectionReason}</p>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Deliveries completed"
          value={deliveryStats.delivered}
          icon={<Package size={18} />}
          iconColor="#3B82F6"
          iconSurface="var(--color-info-surface)"
          trendLabel={`${deliveryStats.assigned} assigned`}
        />
        <StatCard
          label="Completion rate"
          value={`${deliveryStats.completionRate}%`}
          icon={<CheckCircle2 size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Total earnings"
          value={formatCurrency(payout?.totalEarnings ?? 0)}
          icon={<IndianRupee size={18} />}
          iconColor="#7C3AED"
          iconSurface="var(--color-violet-surface)"
        />
        <StatCard
          label="Pending payout"
          value={formatCurrency(payout?.pendingAmount ?? 0)}
          icon={<Clock size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
      </div>

      <div className="mt-5">
        <Tabs items={tabItems} value={activeTab} onChange={(v) => setActiveTab(v as DetailTab)} />
      </div>

      <Card className="mt-4">
        {activeTab === 'application' ? (
          driverApi && (
            <DriverApplication driver={driverApi} onReview={isSubmitted ? reviewItem : undefined} />
          )
        ) : activeTab === 'deliveries' ? (
          driverOrders.length === 0 ? (
            <EmptyState icon={<Package size={22} />} title="No deliveries yet" description="This driver hasn't been assigned any orders." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Vendor</Th>
                  <Th>Status</Th>
                  <Th>Placed</Th>
                </Tr>
              </Thead>
              <tbody>
                {driverOrders.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <Link to={`/orders/${o.id}`} className="font-semibold text-ink-800 hover:text-brand-700">
                        {o.orderNumber ?? o.id}
                      </Link>
                    </Td>
                    <Td>{o.customerName}</Td>
                    <Td>{o.vendorName}</Td>
                    <Td>
                      <StatusBadge status={o.status} label={ORDER_STATUS_META[o.status].label} />
                    </Td>
                    <Td className="text-ink-500">{formatDateTime(o.placedAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )
        ) : !payout ? (
          <EmptyState icon={<IndianRupee size={22} />} title="No payouts yet" description="Payout totals will appear here once earnings are recorded." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Deliveries</Th>
                <Th>Pending</Th>
                <Th>Settled</Th>
                <Th>Paid</Th>
                <Th>Total earnings</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
              </Tr>
            </Thead>
            <tbody>
              <Tr>
                <Td>{payout.deliveries}</Td>
                <Td>{formatCurrency(payout.pendingAmount)}</Td>
                <Td>{formatCurrency(payout.settledAmount)}</Td>
                <Td>{formatCurrency(payout.paidAmount)}</Td>
                <Td className="font-semibold text-ink-800">{formatCurrency(payout.totalEarnings)}</Td>
                <Td>
                  <StatusBadge status={payout.status} />
                </Td>
                <Td className="text-ink-500">{formatDate(payout.updatedAt)}</Td>
              </Tr>
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Suspend delivery partner?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => updateStatus('suspended')} loading={updating}>
              Suspend partner
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          {driver.name} will be blocked from accepting new deliveries until reactivated. Their KYC verification is kept
          as-is.
        </p>
      </Modal>

      <ReasonModal
        open={rejectOpen}
        title={`Reject ${driver.name}?`}
        label="Reason for rejection"
        hint="Shown to the driver so they know what to fix."
        placeholder="e.g. Vehicle RC has expired"
        confirmLabel="Reject driver"
        busy={updating}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => updateStatus('rejected', reason)}
      />
    </div>
  );
}
