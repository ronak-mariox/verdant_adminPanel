import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, UserX, PackageSearch, Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Drawer';
import { InlineAlert } from '@/components/ui/InlineAlert';
import type { Customer, CustomerStatus } from '@/types';
import { formatDate } from '@/lib/format';
import { api, ApiError, buildQuery } from '@/lib/api';
import { useDebounce } from '@/lib/useDebounce';
import { avatarColorFor } from '@/lib/avatarColor';

const STATUS_TABS: { value: CustomerStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
];

const PAGE_SIZE = 15;

// ---------------------------------------------------------------------------
// Backend shape (GET /admin/customers)
// ---------------------------------------------------------------------------

interface ApiCustomer {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  status: CustomerStatus;
  createdAt: string;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
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

export function Customers() {
  const [allCustomers, setAllCustomers] = useState<ApiCustomer[]>([]);
  const [apiCustomers, setApiCustomers] = useState<ApiCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<CustomerStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [blockTarget, setBlockTarget] = useState<Customer | null>(null);

  const debouncedSearch = useDebounce(search.trim(), 300);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ApiCustomer[]>('/admin/customers')
      .then((data) => {
        if (!cancelled) setAllCustomers(data);
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
        const data = await api.get<ApiCustomer[]>(`/admin/customers${qs}`);
        if (!cancelled) setApiCustomers(data);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load customers'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, statusTab, debouncedSearch]);

  const customers = useMemo(() => apiCustomers.map(mapCustomer), [apiCustomers]);

  const totalCustomers = allCustomers.length;
  const activeCount = allCustomers.filter((c) => c.status === 'active').length;
  const blockedCount = allCustomers.filter((c) => c.status === 'blocked').length;

  const pageCount = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = customers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const tabItems: TabItem[] = STATUS_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: t.value === 'all' ? totalCustomers : allCustomers.filter((c) => c.status === t.value).length,
  }));

  async function setCustomerStatus(id: string, status: CustomerStatus) {
    setActionError(null);
    try {
      const updated = await api.patch<ApiCustomer>(`/admin/customers/${id}/status`, { status });
      setApiCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setAllCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update customer status'));
    }
  }

  const unblock = (id: string) => setCustomerStatus(id, 'active');
  const confirmBlock = () => {
    if (!blockTarget) return;
    setCustomerStatus(blockTarget.id, 'blocked');
    setBlockTarget(null);
  };

  return (
    <div>
      <PageHeader title="Customers" subtitle="View and manage the Verdant customer base" />

      {actionError && <InlineAlert message={actionError} className="mb-4" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total customers"
          value={totalCustomers}
          icon={<Users size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={<UserCheck size={18} />}
          iconColor="#3B82F6"
          iconSurface="var(--color-info-surface)"
        />
        <StatCard
          label="Blocked"
          value={blockedCount}
          icon={<UserX size={18} />}
          iconColor="#DC2626"
          iconSurface="var(--color-danger-surface)"
        />
      </div>

      <div className="mt-5">
        <Tabs
          items={tabItems}
          value={statusTab}
          onChange={(v) => {
            setStatusTab(v as CustomerStatus | 'all');
            setPage(1);
          }}
        />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-4">
          <SearchInput
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full max-w-xs"
          />
        </div>

        {loading ? (
          <EmptyState icon={<Loader2 size={24} className="animate-spin" />} title="Loading customers…" />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle size={24} />}
            title="Couldn't load customers"
            description={loadError}
            action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
          />
        ) : paged.length === 0 ? (
          <EmptyState
            icon={<PackageSearch size={24} />}
            title="No customers found"
            description="Try adjusting your search or filters."
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </Tr>
            </Thead>
            <tbody>
              {paged.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} color={c.avatarColor} size={38} />
                      <div className="min-w-0">
                        <Link
                          to={`/customers/${c.id}`}
                          className="block truncate font-semibold text-ink-800 hover:text-brand-700"
                        >
                          {c.name}
                        </Link>
                        <p className="truncate text-[12.5px] text-ink-500">{c.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-ink-600">{c.phone}</Td>
                  <Td className="text-ink-500">{formatDate(c.joinedAt)}</Td>
                  <Td>
                    <StatusBadge status={c.status} />
                  </Td>
                  <Td className="text-right">
                    {c.status === 'blocked' ? (
                      <button
                        onClick={() => unblock(c.id)}
                        className="rounded-md bg-success-surface px-2.5 py-1 text-[11px] font-semibold text-success hover:bg-success/20"
                      >
                        Unblock
                      </button>
                    ) : (
                      <button
                        onClick={() => setBlockTarget(c)}
                        className="rounded-md bg-danger-surface px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/20"
                      >
                        Block
                      </button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {!loading && !loadError && (
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onChange={setPage}
            total={customers.length}
            pageSize={PAGE_SIZE}
          />
        )}
      </Card>

      <Modal
        open={blockTarget !== null}
        onClose={() => setBlockTarget(null)}
        title="Block this customer?"
        footer={
          <>
            <Button variant="outline" onClick={() => setBlockTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmBlock}>
              Block customer
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          {blockTarget?.name} will no longer be able to place orders on Verdant until unblocked.
        </p>
      </Modal>
    </div>
  );
}
