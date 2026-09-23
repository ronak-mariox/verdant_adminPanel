import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, CircleCheck, Bike, Store } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Select } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { api, fetchAllPaginated } from '@/lib/api';
import {
  mapVendorSettlement,
  mapDriverPayout,
  errorMessage,
  type ApiVendorSettlement,
  type ApiDriverPayout,
} from '@/lib/adminSettlements';
import type { DriverPayoutSummary, VendorSettlementRecord } from '@/types';
import { formatCurrency, formatDate } from '@/lib/format';

const PAGE_SIZE = 14;

const DRIVER_STATUSES: DriverPayoutSummary['status'][] = ['pending', 'processing', 'paid'];

type Tab = 'vendors' | 'drivers';

export function Settlements() {
  const [tab, setTab] = useState<Tab>('vendors');

  const [vendorSettlements, setVendorSettlements] = useState<VendorSettlementRecord[]>([]);
  const [driverPayouts, setDriverPayouts] = useState<DriverPayoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [driverStatus, setDriverStatus] = useState<DriverPayoutSummary['status'] | 'all'>('all');
  const [vendorPage, setVendorPage] = useState(1);
  const [driverPage, setDriverPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [vendorsRaw, driversRaw] = await Promise.all([
          fetchAllPaginated<ApiVendorSettlement>('/admin/settlements/vendors'),
          api.get<ApiDriverPayout[]>('/admin/settlements/drivers'),
        ]);
        if (cancelled) return;
        setVendorSettlements(vendorsRaw.map(mapVendorSettlement));
        setDriverPayouts(driversRaw.map(mapDriverPayout));
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load settlements'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const vendorGrossTotal = useMemo(() => vendorSettlements.reduce((sum, s) => sum + s.grossAmount, 0), [vendorSettlements]);
  const vendorNetTotal = useMemo(() => vendorSettlements.reduce((sum, s) => sum + s.netPayout, 0), [vendorSettlements]);
  const driverPendingTotal = useMemo(() => driverPayouts.reduce((sum, p) => sum + p.pendingAmount, 0), [driverPayouts]);
  const driverPaidTotal = useMemo(() => driverPayouts.reduce((sum, p) => sum + p.paidAmount, 0), [driverPayouts]);

  const filteredDrivers = useMemo(
    () => (driverStatus === 'all' ? driverPayouts : driverPayouts.filter((p) => p.status === driverStatus)),
    [driverPayouts, driverStatus],
  );

  const vendorPageCount = Math.max(1, Math.ceil(vendorSettlements.length / PAGE_SIZE));
  const currentVendorPage = Math.min(vendorPage, vendorPageCount);
  const vendorPageItems = vendorSettlements.slice((currentVendorPage - 1) * PAGE_SIZE, currentVendorPage * PAGE_SIZE);

  const driverPageCount = Math.max(1, Math.ceil(filteredDrivers.length / PAGE_SIZE));
  const currentDriverPage = Math.min(driverPage, driverPageCount);
  const driverPageItems = filteredDrivers.slice((currentDriverPage - 1) * PAGE_SIZE, currentDriverPage * PAGE_SIZE);

  const tabItems: TabItem[] = [
    { value: 'vendors', label: 'Vendor Settlements', count: vendorSettlements.length },
    { value: 'drivers', label: 'Driver Payouts', count: driverPayouts.length },
  ];

  return (
    <div>
      <PageHeader title="Settlements & Payouts" subtitle="Track vendor commissions and delivery partner earnings" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Vendor gross sales"
          value={formatCurrency(vendorGrossTotal)}
          icon={<Store size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
        />
        <StatCard
          label="Vendor net payouts"
          value={formatCurrency(vendorNetTotal)}
          icon={<Wallet size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
        />
        <StatCard
          label="Driver payouts pending"
          value={formatCurrency(driverPendingTotal)}
          icon={<Bike size={18} />}
          iconColor="#4338CA"
          iconSurface="var(--color-indigo-surface)"
        />
        <StatCard
          label="Driver payouts paid"
          value={formatCurrency(driverPaidTotal)}
          icon={<CircleCheck size={18} />}
          iconColor="#12866F"
          iconSurface="var(--color-success-surface)"
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title={tab === 'vendors' ? 'Vendor settlements' : 'Driver payouts'}
          subtitle={tab === 'vendors' ? `${vendorSettlements.length} settlements` : `${filteredDrivers.length} payouts`}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <Tabs items={tabItems} value={tab} onChange={(v) => setTab(v as Tab)} />
          {tab === 'drivers' && (
            <Select
              value={driverStatus}
              onChange={(e) => {
                setDriverStatus(e.target.value as DriverPayoutSummary['status'] | 'all');
                setDriverPage(1);
              }}
            >
              <option value="all">All statuses</option>
              {DRIVER_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </Select>
          )}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-ink-400">Loading…</div>
        ) : loadError ? (
          <div className="px-5 py-10 text-center text-sm text-danger">{loadError}</div>
        ) : tab === 'vendors' ? (
          vendorPageItems.length === 0 ? (
            <EmptyState icon={<Store size={24} />} title="No settlements found" description="Settlements appear once orders are delivered." />
          ) : (
            <>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Vendor</Th>
                    <Th>Order</Th>
                    <Th>Date</Th>
                    <Th className="text-right">Gross sales</Th>
                    <Th className="text-right">Commission</Th>
                    <Th className="text-right">GST on commission</Th>
                    <Th className="text-right">Net payout</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {vendorPageItems.map((s) => (
                    <Tr key={s.id}>
                      <Td className="font-semibold text-ink-800">{s.vendorName ?? 'Unknown vendor'}</Td>
                      <Td>
                        <Link to={`/orders/${s.orderId}`} className="font-medium text-brand-700 hover:underline">
                          {s.orderNumber}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-500">{formatDate(s.settledAt)}</Td>
                      <Td className="text-right">{formatCurrency(s.grossAmount)}</Td>
                      <Td className="text-right">
                        {s.commissionRate}% · {formatCurrency(s.commissionAmount)}
                      </Td>
                      <Td className="text-right">{formatCurrency(s.gstOnCommission)}</Td>
                      <Td className="text-right font-semibold text-ink-900">{formatCurrency(s.netPayout)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={currentVendorPage}
                pageCount={vendorPageCount}
                onChange={setVendorPage}
                total={vendorSettlements.length}
                pageSize={PAGE_SIZE}
              />
            </>
          )
        ) : driverPageItems.length === 0 ? (
          <EmptyState icon={<Bike size={24} />} title="No payouts found" description="Try a different status filter." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Driver</Th>
                  <Th className="text-right">Deliveries</Th>
                  <Th className="text-right">Pending</Th>
                  <Th className="text-right">Settled</Th>
                  <Th className="text-right">Paid</Th>
                  <Th className="text-right">Total earnings</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                </Tr>
              </Thead>
              <tbody>
                {driverPageItems.map((p) => (
                  <Tr key={p.driverId}>
                    <Td className="font-semibold text-ink-800">{p.driverName}</Td>
                    <Td className="text-right">{p.deliveries}</Td>
                    <Td className="text-right">{formatCurrency(p.pendingAmount)}</Td>
                    <Td className="text-right">{formatCurrency(p.settledAmount)}</Td>
                    <Td className="text-right">{formatCurrency(p.paidAmount)}</Td>
                    <Td className="text-right font-semibold text-ink-900">{formatCurrency(p.totalEarnings)}</Td>
                    <Td>
                      <StatusBadge status={p.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-ink-500">{formatDate(p.updatedAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={currentDriverPage}
              pageCount={driverPageCount}
              onChange={setDriverPage}
              total={filteredDrivers.length}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </Card>
    </div>
  );
}
