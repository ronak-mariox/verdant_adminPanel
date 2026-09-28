import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, CheckCircle2, Clock, Ban, Check, X, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
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
import type { Vendor, VendorStatus, KycStatus } from '@/types';
import { api, buildQuery } from '@/lib/api';
import { useDebounce } from '@/lib/useDebounce';
import { vendorDisplayName, vendorCity, errorMessage, type ApiVendor as ApiVendorBase } from '@/lib/adminOrders';
import { avatarColorFor } from '@/lib/avatarColor';

const PAGE_SIZE = 15;

const STATUS_TABS: { value: VendorStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Rejected' },
];

// ---------------------------------------------------------------------------
// Backend shape (GET /admin/vendors) — a superset of adminOrders.ApiVendor so it
// still satisfies vendorDisplayName/vendorCity's parameter type.
// ---------------------------------------------------------------------------

interface ApiVendor extends Omit<ApiVendorBase, 'businessInfo'> {
  email?: string;
  status: VendorStatus;
  kycStatus: KycStatus;
  registrationStep?: string;
  rejectionReason?: string;
  businessInfo?: {
    displayName?: string;
    category?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
  };
  storeInfo?: { storeAddress?: string };
  gstDetails?: { gstin?: string };
  createdAt: string;
}

function mapVendor(v: ApiVendor): Vendor {
  const addressLines = [v.businessInfo?.addressLine1, v.businessInfo?.addressLine2].filter(Boolean).join(', ');
  return {
    id: v.id,
    storeName: vendorDisplayName(v),
    ownerName: v.fullName ?? '—',
    email: v.email ?? '—',
    phone: v.phone,
    avatarColor: avatarColorFor(v.id),
    category: v.businessInfo?.category ?? '—',
    city: vendorCity(v),
    address: addressLines || v.storeInfo?.storeAddress || '—',
    status: v.status,
    kycStatus: v.kycStatus,
    registrationStep: v.registrationStep ?? '',
    rejectionReason: v.rejectionReason,
    joinedAt: v.createdAt,
    gstNumber: v.gstDetails?.gstin ?? '—',
  };
}

export function Vendors() {
  const [allVendors, setAllVendors] = useState<ApiVendor[]>([]);
  const [apiVendors, setApiVendors] = useState<ApiVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [statusTab, setStatusTab] = useState<VendorStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<Vendor | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search.trim(), 300);

  // The unfiltered roster is loaded once for the stat cards + tab counts; the
  // table itself is re-fetched with server-side status/search filters.
  useEffect(() => {
    let cancelled = false;
    api
      .get<ApiVendor[]>('/admin/vendors')
      .then((data) => {
        if (!cancelled) setAllVendors(data);
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
        const data = await api.get<ApiVendor[]>(`/admin/vendors${qs}`);
        if (!cancelled) setApiVendors(data);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load vendors'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, statusTab, debouncedSearch]);

  const vendorList = useMemo(() => apiVendors.map(mapVendor), [apiVendors]);

  const categories = useMemo(
    () => Array.from(new Set(allVendors.map((v) => v.businessInfo?.category).filter((c): c is string => !!c))).sort(),
    [allVendors],
  );

  const tabItems: TabItem[] = STATUS_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: t.value === 'all' ? allVendors.length : allVendors.filter((v) => v.status === t.value).length,
  }));

  const filtered = useMemo(
    () => (category === 'all' ? vendorList : vendorList.filter((v) => v.category === category)),
    [vendorList, category],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalVendors = allVendors.length;
  const activeCount = allVendors.filter((v) => v.status === 'active').length;
  const awaitingReview = allVendors.filter((v) => v.status === 'pending' && v.registrationStep === 'submitted').length;
  const inProgress = allVendors.filter((v) => v.status === 'pending' && v.registrationStep !== 'submitted').length;
  const suspendedRejectedCount = allVendors.filter((v) => v.status === 'suspended' || v.status === 'rejected').length;

  async function updateStatus(id: string, status: VendorStatus, rejectionReason?: string) {
    setActionError(null);
    setBusyId(id);
    try {
      const updated = await api.patch<ApiVendor>(`/admin/vendors/${id}/status`, {
        status,
        ...(rejectionReason ? { rejectionReason } : {}),
      });
      setApiVendors((prev) => prev.map((v) => (v.id === id ? updated : v)));
      setAllVendors((prev) => prev.map((v) => (v.id === id ? updated : v)));
      setRejectTarget(null);
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update vendor status'));
    } finally {
      setBusyId(null);
    }
  }

  function handleTabChange(value: string) {
    setStatusTab(value as VendorStatus | 'all');
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Manage the vendor roster — review sign-ups, monitor stores, and handle suspensions"
      />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total vendors"
          value={totalVendors}
          icon={<Store size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={<CheckCircle2 size={18} />}
          iconColor="#12866F"
          iconSurface="var(--color-success-surface)"
        />
        <StatCard
          label="Awaiting review"
          value={awaitingReview}
          icon={<Clock size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
          trendLabel={`${inProgress} still registering`}
        />
        <StatCard
          label="Suspended / rejected"
          value={suspendedRejectedCount}
          icon={<Ban size={18} />}
          iconColor="#DC2626"
          iconSurface="var(--color-danger-surface)"
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="All vendors"
          subtitle={`${filtered.length} vendor${filtered.length === 1 ? '' : 's'}`}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <Tabs items={tabItems} value={statusTab} onChange={handleTabChange} />
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              placeholder="Search store, owner or phone…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64"
            />
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {loading ? (
          <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading vendors…" />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle size={24} />}
            title="Couldn't load vendors"
            description={loadError}
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        ) : pageItems.length === 0 ? (
          <EmptyState
            icon={<Store size={24} />}
            title="No vendors found"
            description="Try adjusting your search or filters to find what you're looking for."
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Store</Th>
                <Th>Category</Th>
                <Th>City</Th>
                <Th>Phone</Th>
                <Th>KYC</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <tbody>
              {pageItems.map((vendor) => {
                const busy = busyId === vendor.id;
                return (
                  <Tr key={vendor.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={vendor.storeName} color={vendor.avatarColor} size={40} />
                        <div className="min-w-0">
                          <Link
                            to={`/vendors/${vendor.id}`}
                            className="block truncate font-semibold text-ink-800 hover:text-brand-700"
                          >
                            {vendor.storeName}
                          </Link>
                          <p className="truncate text-[12.5px] text-ink-500">{vendor.ownerName}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{vendor.category}</Td>
                    <Td className="whitespace-nowrap">{vendor.city}</Td>
                    <Td className="whitespace-nowrap text-ink-600">{vendor.phone}</Td>
                    <Td>
                      <StatusBadge status={vendor.kycStatus} />
                    </Td>
                    <Td>
                      <StatusBadge status={vendor.status} />
                    </Td>
                    <Td>
                      {vendor.status === 'pending' ? (
                        vendor.registrationStep === 'submitted' ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="primary"
                              icon={<Check size={14} />}
                              disabled={busy}
                              onClick={() => updateStatus(vendor.id, 'active')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              icon={<X size={14} />}
                              disabled={busy}
                              onClick={() => setRejectTarget(vendor)}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[12.5px] text-ink-400">Registration in progress</span>
                        )
                      ) : vendor.status === 'suspended' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<RotateCcw size={14} />}
                          disabled={busy}
                          onClick={() => updateStatus(vendor.id, 'active')}
                        >
                          Reactivate
                        </Button>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {!loading && !loadError && pageItems.length > 0 && (
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
        title={`Reject ${rejectTarget?.storeName ?? 'vendor'}?`}
        description="The vendor will be notified with this reason and can re-apply after fixing the issue."
        label="Reason for rejection"
        placeholder="e.g. GST certificate doesn't match the registered business name"
        confirmLabel="Reject vendor"
        busy={busyId !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => rejectTarget && updateStatus(rejectTarget.id, 'rejected', reason)}
      />
    </div>
  );
}
