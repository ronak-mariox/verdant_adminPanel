import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, CheckCircle2, Star, ShieldAlert, Bike, PackageSearch, Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput, Select } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import type { Driver, DriverStatus, KycStatus } from '@/types';
import { formatCurrency } from '@/lib/format';
import { api, ApiError } from '@/lib/api';
import { avatarColorFor } from '@/lib/avatarColor';

const STATUS_TABS: { value: DriverStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Rejected' },
];

const VEHICLE_TYPES: { value: string; label: string }[] = [
  { value: 'all', label: 'All vehicles' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'motorbike', label: 'Motorbike' },
  { value: 'scooter', label: 'Scooter' },
  { value: 'other', label: 'Other' },
];

const PAGE_SIZE = 15;

// ---------------------------------------------------------------------------
// Backend shape (GET /admin/drivers)
// ---------------------------------------------------------------------------

interface ApiDriver {
  id: string;
  phone: string;
  fullName?: string;
  email?: string;
  status: DriverStatus;
  kycStatus: KycStatus;
  vehicleType?: 'motorbike' | 'scooter' | 'bicycle' | 'other';
  vehicleDetails?: { registrationNumber?: string };
  address?: { city?: string };
  createdAt: string;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function mapDriver(d: ApiDriver): Driver {
  return {
    id: d.id,
    name: d.fullName || d.phone,
    phone: d.phone,
    email: d.email ?? '—',
    avatarColor: avatarColorFor(d.id),
    vehicleType: d.vehicleType ?? 'other',
    vehicleNumber: d.vehicleDetails?.registrationNumber ?? '—',
    // No delivery-zone concept server-side — the driver's registered city is the
    // closest honest stand-in.
    zone: d.address?.city ?? '—',
    status: d.status,
    kycStatus: d.kycStatus,
    // No ratings, delivery counts or earnings data server-side yet (and no
    // driver-assignment/payout system wired up to compute them from orders on
    // this list page without an N+1 fetch) — always 0, never fabricated.
    rating: 0,
    totalDeliveries: 0,
    completionRate: 0,
    earningsThisMonth: 0,
    joinedAt: d.createdAt,
  };
}

export function Drivers() {
  const [apiDrivers, setApiDrivers] = useState<ApiDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [statusTab, setStatusTab] = useState<DriverStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.get<ApiDriver[]>('/admin/drivers');
        if (!cancelled) setApiDrivers(data);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load delivery partners'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const drivers = useMemo(() => apiDrivers.map(mapDriver), [apiDrivers]);

  const totalDrivers = drivers.length;
  const activeCount = drivers.filter((d) => d.status === 'active').length;
  const avgRating = totalDrivers ? (drivers.reduce((sum, d) => sum + d.rating, 0) / totalDrivers).toFixed(1) : '0.0';
  const pendingKyc = drivers.filter((d) => d.kycStatus === 'pending').length;

  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => {
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q) ||
        d.zone.toLowerCase().includes(q);
      const matchesVehicle = vehicleFilter === 'all' || d.vehicleType === vehicleFilter;
      return matchesSearch && matchesVehicle;
    });
  }, [drivers, search, vehicleFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: searchFiltered.length };
    (['pending', 'active', 'suspended', 'rejected'] as DriverStatus[]).forEach((s) => {
      counts[s] = searchFiltered.filter((d) => d.status === s).length;
    });
    return counts;
  }, [searchFiltered]);

  const filtered = useMemo(() => {
    if (statusTab === 'all') return searchFiltered;
    return searchFiltered.filter((d) => d.status === statusTab);
  }, [searchFiltered, statusTab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabItems: TabItem[] = STATUS_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: statusCounts[t.value] ?? 0,
  }));

  // KYC approve/reject and the driver's overall account status are the same
  // field group server-side (PATCH /admin/drivers/:id/status requires a
  // status value from active/suspended/rejected — 'pending' isn't accepted back).
  // For a driver still pending review, approving/rejecting their KYC is the same
  // action as approving/rejecting the driver; for an already-active/suspended
  // driver it just re-flags kycStatus while leaving their account status as-is.
  async function setDriverKyc(driverId: string, kycStatus: 'verified' | 'rejected') {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;
    setActionError(null);
    try {
      const nextStatus: DriverStatus =
        driver.status === 'pending' ? (kycStatus === 'verified' ? 'active' : 'rejected') : driver.status;
      const updated = await api.patch<ApiDriver>(`/admin/drivers/${driverId}/status`, {
        status: nextStatus,
        kycStatus,
      });
      setApiDrivers((prev) => prev.map((d) => (d.id === driverId ? updated : d)));
    } catch (err) {
      setActionError(errorMessage(err, `Failed to ${kycStatus === 'verified' ? 'approve' : 'reject'} KYC`));
    }
  }

  const approveKyc = (id: string) => setDriverKyc(id, 'verified');
  const rejectKyc = (id: string) => setDriverKyc(id, 'rejected');

  return (
    <div>
      <PageHeader
        title="Delivery Partners"
        subtitle="Monitor delivery partner account status, KYC status and performance"
      />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total drivers"
          value={totalDrivers}
          icon={<Users size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Active drivers"
          value={activeCount}
          icon={<CheckCircle2 size={18} />}
          iconColor="#3B82F6"
          iconSurface="var(--color-info-surface)"
        />
        <StatCard
          label="Avg rating"
          value={avgRating}
          icon={<Star size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
        <StatCard
          label="Pending KYC"
          value={pendingKyc}
          icon={<ShieldAlert size={18} />}
          iconColor="#DC2626"
          iconSurface="var(--color-danger-surface)"
        />
      </div>

      <div className="mt-5">
        <Tabs
          items={tabItems}
          value={statusTab}
          onChange={(v) => {
            setStatusTab(v as DriverStatus | 'all');
            setPage(1);
          }}
        />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-4">
          <SearchInput
            placeholder="Search by name, phone or zone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full max-w-xs"
          />
          <Select
            value={vehicleFilter}
            onChange={(e) => {
              setVehicleFilter(e.target.value);
              setPage(1);
            }}
          >
            {VEHICLE_TYPES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading delivery partners…" />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle size={24} />}
            title="Couldn't load delivery partners"
            description={loadError}
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        ) : paged.length === 0 ? (
          <EmptyState
            icon={<PackageSearch size={24} />}
            title="No delivery partners found"
            description="Try adjusting your search or filters."
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Driver</Th>
                <Th>Zone</Th>
                <Th>Vehicle</Th>
                <Th>Status</Th>
                <Th>KYC</Th>
                <Th>Rating</Th>
                <Th>Deliveries</Th>
                <Th>Completion</Th>
                <Th className="text-right">Earnings (month)</Th>
              </Tr>
            </Thead>
            <tbody>
              {paged.map((d) => (
                <Tr key={d.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={d.name} color={d.avatarColor} size={38} />
                      <div className="min-w-0">
                        <Link
                          to={`/drivers/${d.id}`}
                          className="block truncate font-semibold text-ink-800 hover:text-brand-700"
                        >
                          {d.name}
                        </Link>
                        <p className="text-[12.5px] text-ink-500">{d.phone}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-ink-600">{d.zone}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5 text-ink-700">
                      <Bike size={14} className="text-ink-400" />
                      <span className="capitalize">{d.vehicleType}</span>
                    </div>
                    <p className="text-[12px] text-ink-500">{d.vehicleNumber}</p>
                  </Td>
                  <Td>
                    <StatusBadge status={d.status} />
                  </Td>
                  <Td>
                    <StatusBadge status={d.kycStatus} />
                    {d.kycStatus === 'pending' && (
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          onClick={() => approveKyc(d.id)}
                          className="rounded-md bg-success-surface px-2 py-0.5 text-[11px] font-semibold text-success hover:bg-success/20"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectKyc(d.id)}
                          className="rounded-md bg-danger-surface px-2 py-0.5 text-[11px] font-semibold text-danger hover:bg-danger/20"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Star size={13} className="fill-warning text-warning" />
                      <span className="font-medium text-ink-800">{d.rating}</span>
                    </div>
                  </Td>
                  <Td className="text-ink-700">{d.totalDeliveries}</Td>
                  <Td className="text-ink-700">{d.completionRate}%</Td>
                  <Td className="text-right font-semibold text-ink-800">
                    {formatCurrency(d.earningsThisMonth)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {!loading && !loadError && (
          <Pagination
            page={page}
            pageCount={pageCount}
            onChange={setPage}
            total={filtered.length}
            pageSize={PAGE_SIZE}
          />
        )}
      </Card>
    </div>
  );
}
