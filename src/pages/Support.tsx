import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, CircleDot, Clock, CheckCircle2, ArrowUpCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { SearchInput, Select } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchAllPaginated } from '@/lib/api';
import { mapTicket, errorMessage, type ApiSupportTicket } from '@/lib/adminSupport';
import type { SupportTicketRecord, TicketPriority, TicketStatus } from '@/types';
import { timeAgo } from '@/lib/format';

const PAGE_SIZE = 14;

const STATUS_TABS: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
];

const PRIORITY_TONE: Record<TicketPriority, 'danger' | 'warning' | 'info' | 'neutral'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

const RAISED_BY_TONE: Record<string, 'brand' | 'violet' | 'indigo'> = {
  customer: 'brand',
  vendor: 'violet',
  driver: 'indigo',
};

export function Support() {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusTab, setStatusTab] = useState<TicketStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<TicketPriority | 'all'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const raw = await fetchAllPaginated<ApiSupportTicket>('/admin/support-tickets');
        if (cancelled) return;
        setTickets(raw.map(mapTicket));
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load support tickets'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCount = useMemo(() => tickets.filter((t) => t.status === 'open').length, [tickets]);
  const inProgressCount = useMemo(() => tickets.filter((t) => t.status === 'in-progress').length, [tickets]);
  const resolvedCount = useMemo(() => tickets.filter((t) => t.status === 'resolved').length, [tickets]);
  const escalatedCount = useMemo(() => tickets.filter((t) => t.status === 'escalated').length, [tickets]);

  const tabItems: TabItem[] = STATUS_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: t.value === 'all' ? tickets.length : tickets.filter((tk) => tk.status === t.value).length,
  }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusTab !== 'all' && t.status !== statusTab) return false;
      if (priority !== 'all' && t.priority !== priority) return false;
      if (q && !`${t.subject} ${t.raisedByName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tickets, statusTab, priority, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleTabChange(value: string) {
    setStatusTab(value as TicketStatus | 'all');
    setPage(1);
  }

  return (
    <div>
      <PageHeader title="Support Tickets" subtitle="Customer, vendor and driver disputes routed to the admin team" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Open"
          value={openCount}
          icon={<CircleDot size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
        <StatCard
          label="In progress"
          value={inProgressCount}
          icon={<Clock size={18} />}
          iconColor="#3B82F6"
          iconSurface="var(--color-info-surface)"
        />
        <StatCard
          label="Resolved"
          value={resolvedCount}
          icon={<CheckCircle2 size={18} />}
          iconColor="#12866F"
          iconSurface="var(--color-success-surface)"
        />
        <StatCard
          label="Escalated"
          value={escalatedCount}
          icon={<ArrowUpCircle size={18} />}
          iconColor="#DC2626"
          iconSurface="var(--color-danger-surface)"
        />
      </div>

      <Card className="mt-6">
        <CardHeader title="All tickets" subtitle={`${filtered.length} ticket${filtered.length === 1 ? '' : 's'}`} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <Tabs items={tabItems} value={statusTab} onChange={handleTabChange} />
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              placeholder="Search subject, raised by…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64"
            />
            <Select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value as TicketPriority | 'all');
                setPage(1);
              }}
            >
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-ink-400">Loading tickets…</div>
        ) : loadError ? (
          <div className="px-5 py-10 text-center text-sm text-danger">{loadError}</div>
        ) : pageItems.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy size={24} />}
            title="No tickets found"
            description={
              tickets.length === 0
                ? 'No support tickets have been raised yet.'
                : 'Try adjusting your search or filters.'
            }
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Ticket</Th>
                <Th>Subject</Th>
                <Th>Raised by</Th>
                <Th>Category</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Order</Th>
                <Th>Updated</Th>
              </Tr>
            </Thead>
            <tbody>
              {pageItems.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-mono text-xs font-semibold text-ink-700">{t.id.slice(-8)}</Td>
                  <Td className="max-w-xs truncate font-medium text-ink-800">{t.subject}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink-700">{t.raisedByName}</span>
                      <Badge tone={RAISED_BY_TONE[t.raisedByType]} className="capitalize">
                        {t.raisedByType}
                      </Badge>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-500">{t.category}</Td>
                  <Td>
                    <Badge tone={PRIORITY_TONE[t.priority]} className="capitalize">
                      {t.priority}
                    </Badge>
                  </Td>
                  <Td>
                    <StatusBadge status={t.status} />
                  </Td>
                  <Td>
                    {t.orderId ? (
                      <Link to={`/orders/${t.orderId}`} className="font-medium text-brand-700 hover:underline">
                        View order
                      </Link>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-500">{timeAgo(t.updatedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {!loading && !loadError && pageItems.length > 0 && (
          <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
        )}
      </Card>
    </div>
  );
}
