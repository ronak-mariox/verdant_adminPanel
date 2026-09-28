import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, CheckCircle2, ShieldAlert, Bike, PackageSearch, Loader2, AlertTriangle, Ban } from 'lucide-react';
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
import { ReasonModal } from '@/components/ui/ReasonModal';
import type { Driver, DriverStatus, KycStatus } from '@/types';
import { api, ApiError, buildQuery } from '@/lib/api';
import { useDebounce } from '@/lib/useDebounce';
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
  registrationStep?: string;
  rejectionReason?: string;
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
    registrationStep: d.registrationStep ?? '',
    rejectionReason: d.rejectionReason,
    joinedAt: d.createdAt,
  };
}

export function Drivers() {
  const [allDrivers, setAllDrivers] = useState<ApiDriver[]>([]);
  const [apiDrivers, setApiDrivers] = useState<ApiDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [statusTab, setStatusTab] = useState<DriverStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<Driver | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search.trim(), 300);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ApiDriver[]>('/admin/drivers')
      .then((data) => {
        if (!cancelled) setAllDrivers(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const qs = buildQuery({ status: statusTab === 'all' ? undefined : statusTab, search: debouncedSearch || undefined });
        const data = await api.get<ApiDriver[]>(`/admin/drivers${qs}`);
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
  }, [reloadKey, statusTab, debouncedSearch]);

  const drivers = useMemo(() => apiDrivers.map(mapDriver), [apiDrivers]);

  const totalDrivers = allDrivers.length;
  const activeCount = allDrivers.filter((d) => d.status === 'active').length;
  const suspendedCount = allDrivers.filter((d) => d.status === 'suspended').length;
  const pendingKyc = allDrivers.filter((d) => d.kycStatus === 'pending').length;

  const filtered = useMemo(
    () => (vehicleFilter === 'all' ? drivers : drivers.filter((d) => d.vehicleType === vehicleFilter)),
    [drivers, vehicleFilter],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const tabItems: TabItem[] = STATUS_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: t.value === 'all' ? allDrivers.length : allDrivers.filter((d) => d.status === t.value).length,
  }));

  async function updateStatus(id: string, body: { status: DriverStatus; kycStatus?: KycStatus; rejectionReason?: string }) {
    setActionError(null);
    setBusyId(id);
    try {
      const updated = await api.patch<ApiDriver>(`/admin/drivers/${id}/status`, body);
      setApiDrivers((prev) => prev.map((d) => (d.id === id ? updated : d)));
      setAllDrivers((prev) => prev.map((d) => (d.id === id ? updated : d)));
      setRejectTarget(null);
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update delivery partner'));
    } finally {
      setBusyId(null);
    }
  }

  // Approving a pending driver's KYC activates the account; for an already
  // active/suspended driver only the kycStatus flag changes.
  function approveKyc(d: Driver) {
    updateStatus(d.id, d.status === 'pending' ? { status: 'active' } : { status: d.status, kycStatus: 'verified' });
  }

  function rejectKyc(d: Driver, reason: string) {
    updateStatus(
      d.id,
      d.status === 'pending'
        ? { status: 'rejected', rejectionReason: reason }
        : { status: d.status, kycStatus: 'rejected', rejectionReason: reason },
    );
  }

  return (
    <div>
      <PageHeader
        title="Delivery Partners"
        subtitle="Monitor delivery partner account and KYC status"
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
          label="Pending KYC"
          value={pendingKyc}
          icon={<ShieldAlert size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
        <StatCard
          label="Suspended"
          value={suspendedCount}
          icon={<Ban size={18} />}
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
            placeholder="Search by name or phone…"
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
                <Th>City</Th>
                <Th>Vehicle</Th>
                <Th>Status</Th>
                <Th>KYC</Th>
                <Th>Registration</Th>
              </Tr>
            </Thead>
            <tbody>
              {paged.map((d) => {
                const busy = busyId === d.id;
                return (
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
                      {d.kycStatus === 'pending' && d.status !== 'rejected' && d.registrationStep !== 'submitted' && (
                        <p className="mt-1.5 text-[11.5px] text-ink-500">Waiting for driver to finish registration</p>
                      )}
                      {d.kycStatus === 'pending' && d.status !== 'rejected' && d.registrationStep === 'submitted' && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Link
                            to={`/drivers/${d.id}`}
                            className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700 hover:bg-ink-200"
                          >
                            Review documents
                          </Link>
                          <button
                            disabled={busy}
                            onClick={() => approveKyc(d)}
                            className="rounded-md bg-success-surface px-2 py-0.5 text-[11px] font-semibold text-success hover:bg-success/20 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => setRejectTarget(d)}
                            className="rounded-md bg-danger-surface px-2 py-0.5 text-[11px] font-semibold text-danger hover:bg-danger/20 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </Td>
                    <Td className="text-[12.5px] text-ink-500">
                      {d.status === 'pending' ? (d.registrationStep === 'submitted' ? 'Submitted' : 'In progress') : '—'}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {!loading && !loadError && (
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onChange={setPage}
            total={filtered.length}
            pageSize={PAGE_SIZE}
          />
        )}
      </Card>

      <ReasonModal
        open={rejectTarget !== null}
        title={`Reject KYC for ${rejectTarget?.name ?? 'driver'}?`}
        label="Reason for rejection"
        hint="Shown to the driver so they know what to fix."
        placeholder="e.g. Driving licence photo is unreadable"
        confirmLabel="Reject"
        busy={busyId !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => rejectTarget && rejectKyc(rejectTarget, reason)}
      />
    </div>
  );
}
