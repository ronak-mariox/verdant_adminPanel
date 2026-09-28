import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, CircleCheck, Bike, Store, Layers, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Field, Input, Select } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Drawer';
import { ReasonModal } from '@/components/ui/ReasonModal';
import { api, fetchAllPaginatedWithMeta, fetchPage, truncationMessage } from '@/lib/api';
import {
  mapVendorSettlement,
  mapDriverPayout,
  mapPayoutBatch,
  errorMessage,
  type ApiVendorSettlement,
  type ApiDriverPayout,
  type ApiPayoutBatch,
} from '@/lib/adminSettlements';
import type { DriverPayoutSummary, PayoutBatch, PayoutBatchStatus, VendorSettlementRecord } from '@/types';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';

const PAGE_SIZE = 14;
const BATCH_PAGE_SIZE = 20;

const DRIVER_STATUSES: DriverPayoutSummary['status'][] = ['pending', 'processing', 'paid'];
const BATCH_STATUSES: PayoutBatchStatus[] = ['pending', 'paid', 'failed'];

type Tab = 'batches' | 'vendors' | 'drivers';

export function Settlements() {
  const [tab, setTab] = useState<Tab>('batches');

  const [vendorSettlements, setVendorSettlements] = useState<VendorSettlementRecord[]>([]);
  const [vendorTruncation, setVendorTruncation] = useState<string | null>(null);
  const [driverPayouts, setDriverPayouts] = useState<DriverPayoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchStatus, setBatchStatus] = useState<PayoutBatchStatus | 'all'>('all');
  const [batchPage, setBatchPage] = useState(1);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [batchReloadKey, setBatchReloadKey] = useState(0);

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyBatchId, setBusyBatchId] = useState<string | null>(null);
  const [paidTarget, setPaidTarget] = useState<PayoutBatch | null>(null);
  const [paidForm, setPaidForm] = useState({ transactionRef: '', bankAccountLabel: '' });
  const [failedTarget, setFailedTarget] = useState<PayoutBatch | null>(null);

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
          fetchAllPaginatedWithMeta<ApiVendorSettlement>('/admin/settlements/vendors'),
          api.get<ApiDriverPayout[]>('/admin/settlements/drivers'),
        ]);
        if (cancelled) return;
        setVendorSettlements(vendorsRaw.items.map(mapVendorSettlement));
        setVendorTruncation(vendorsRaw.truncated ? truncationMessage(vendorsRaw.total, vendorsRaw.items.length) : null);
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

  useEffect(() => {
    let cancelled = false;
    async function loadBatches() {
      setBatchesLoading(true);
      setBatchesError(null);
      try {
        const res = await fetchPage<ApiPayoutBatch>('/admin/settlements/batches', {
          status: batchStatus === 'all' ? undefined : batchStatus,
          page: batchPage,
          limit: BATCH_PAGE_SIZE,
        });
        if (cancelled) return;
        setBatches(res.items.map(mapPayoutBatch));
        setBatchTotal(res.total);
      } catch (err) {
        if (!cancelled) setBatchesError(errorMessage(err, 'Failed to load payout batches'));
      } finally {
        if (!cancelled) setBatchesLoading(false);
      }
    }
    loadBatches();
    return () => {
      cancelled = true;
    };
  }, [batchStatus, batchPage, batchReloadKey]);

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

  const batchPageCount = Math.max(1, Math.ceil(batchTotal / BATCH_PAGE_SIZE));
  const currentBatchPage = Math.min(batchPage, batchPageCount);

  const tabItems: TabItem[] = [
    { value: 'batches', label: 'Payout Batches', count: batchStatus === 'all' ? batchTotal : undefined },
    { value: 'vendors', label: 'Vendor Settlements', count: vendorSettlements.length },
    { value: 'drivers', label: 'Driver Payouts', count: driverPayouts.length },
  ];

  async function markPaid() {
    if (!paidTarget) return;
    setBusyBatchId(paidTarget.id);
    setActionError(null);
    try {
      const updated = await api.patch<ApiPayoutBatch>(`/admin/settlements/batches/${paidTarget.id}/paid`, {
        transactionRef: paidForm.transactionRef.trim() || undefined,
        bankAccountLabel: paidForm.bankAccountLabel.trim() || undefined,
      });
      setBatches((prev) => prev.map((b) => (b.id === paidTarget.id ? mapPayoutBatch({ ...updated, vendorName: paidTarget.vendorName }) : b)));
      setPaidTarget(null);
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to mark batch as paid'));
      setPaidTarget(null);
    } finally {
      setBusyBatchId(null);
    }
  }

  async function markFailed(failureReason: string) {
    if (!failedTarget) return;
    setBusyBatchId(failedTarget.id);
    setActionError(null);
    try {
      const updated = await api.patch<ApiPayoutBatch>(`/admin/settlements/batches/${failedTarget.id}/failed`, { failureReason });
      setBatches((prev) => prev.map((b) => (b.id === failedTarget.id ? mapPayoutBatch({ ...updated, vendorName: failedTarget.vendorName }) : b)));
      setFailedTarget(null);
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to mark batch as failed'));
      setFailedTarget(null);
    } finally {
      setBusyBatchId(null);
    }
  }

  const subtitle =
    tab === 'batches'
      ? `${batchTotal} batch${batchTotal === 1 ? '' : 'es'}`
      : tab === 'vendors'
        ? `${vendorSettlements.length} per-order settlements`
        : `${filteredDrivers.length} payouts`;

  return (
    <div>
      <PageHeader title="Settlements & Payouts" subtitle="Track vendor commissions, weekly payout batches and delivery partner earnings" />

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

      {actionError && <InlineAlert message={actionError} className="mt-4" />}

      <Card className="mt-6">
        <CardHeader
          title={tab === 'batches' ? 'Vendor payout batches' : tab === 'vendors' ? 'Vendor settlements' : 'Driver payouts'}
          subtitle={subtitle}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <Tabs items={tabItems} value={tab} onChange={(v) => setTab(v as Tab)} />
          {tab === 'batches' && (
            <Select
              value={batchStatus}
              onChange={(e) => {
                setBatchStatus(e.target.value as PayoutBatchStatus | 'all');
                setBatchPage(1);
              }}
            >
              <option value="all">All statuses</option>
              {BATCH_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </Select>
          )}
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

        {tab === 'batches' ? (
          batchesLoading ? (
            <div className="px-5 py-10 text-center text-sm text-ink-400">Loading…</div>
          ) : batchesError ? (
            <EmptyState
              icon={<Layers size={24} />}
              title="Couldn't load payout batches"
              description={batchesError}
              action={<Button onClick={() => setBatchReloadKey((k) => k + 1)}>Retry</Button>}
            />
          ) : batches.length === 0 ? (
            <EmptyState
              icon={<Layers size={24} />}
              title="No payout batches"
              description="Weekly batches are built from delivered-order settlements."
            />
          ) : (
            <>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Vendor</Th>
                    <Th>Period</Th>
                    <Th className="text-right">Orders</Th>
                    <Th className="text-right">Gross</Th>
                    <Th className="text-right">Commission</Th>
                    <Th className="text-right">GST</Th>
                    <Th className="text-right">Net payout</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {batches.map((b) => (
                    <Tr key={b.id}>
                      <Td>
                        <Link to={`/vendors/${b.vendorId}`} className="font-semibold text-ink-800 hover:text-brand-700">
                          {b.vendorName}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-500">
                        {formatDate(b.periodStart)} – {formatDate(b.periodEnd)}
                      </Td>
                      <Td className="text-right">{b.settlementCount}</Td>
                      <Td className="text-right">{formatCurrency(b.totalGross)}</Td>
                      <Td className="text-right">{formatCurrency(b.totalCommission)}</Td>
                      <Td className="text-right">{formatCurrency(b.totalGst)}</Td>
                      <Td className="text-right font-semibold text-ink-900">{formatCurrency(b.netPayout)}</Td>
                      <Td>
                        <StatusBadge status={b.status} />
                        {b.status === 'paid' && b.paidAt && (
                          <p className="mt-1 text-[11px] text-ink-500">
                            {formatDate(b.paidAt)}
                            {b.transactionRef ? ` · ${b.transactionRef}` : ''}
                          </p>
                        )}
                        {b.status === 'failed' && b.failureReason && (
                          <p className="mt-1 max-w-[200px] truncate text-[11px] text-danger" title={b.failureReason}>
                            {b.failureReason}
                          </p>
                        )}
                      </Td>
                      <Td className="text-right">
                        {b.status !== 'paid' && (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              icon={<CircleCheck size={14} />}
                              disabled={busyBatchId === b.id}
                              onClick={() => {
                                setPaidForm({ transactionRef: '', bankAccountLabel: '' });
                                setPaidTarget(b);
                              }}
                            >
                              Mark paid
                            </Button>
                            {b.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                icon={<XCircle size={14} />}
                                disabled={busyBatchId === b.id}
                                onClick={() => setFailedTarget(b)}
                              >
                                Failed
                              </Button>
                            )}
                          </div>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={currentBatchPage}
                pageCount={batchPageCount}
                onChange={setBatchPage}
                total={batchTotal}
                pageSize={BATCH_PAGE_SIZE}
              />
            </>
          )
        ) : loading ? (
          <div className="px-5 py-10 text-center text-sm text-ink-400">Loading…</div>
        ) : loadError ? (
          <div className="px-5 py-10 text-center text-sm text-danger">{loadError}</div>
        ) : tab === 'vendors' ? (
          vendorPageItems.length === 0 ? (
            <EmptyState icon={<Store size={24} />} title="No settlements found" description="Settlements appear once orders are delivered." />
          ) : (
            <>
              {vendorTruncation && <InlineAlert tone="warning" message={vendorTruncation} className="mx-5 mt-4" />}
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
                      <Td>
                        <Link to={`/vendors/${s.vendorId}`} className="font-semibold text-ink-800 hover:text-brand-700">
                          {s.vendorName ?? 'Unknown vendor'}
                        </Link>
                      </Td>
                      <Td>
                        <Link to={`/orders/${s.orderId}`} className="font-medium text-brand-700 hover:underline">
                          {s.orderNumber}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-500">{formatDate(s.settledAt)}</Td>
                      <Td className="text-right">{formatCurrency(s.grossAmount)}</Td>
                      <Td className="text-right">
                        {formatCurrency(s.commissionAmount)} <span className="text-ink-400">({formatPercent(s.commissionRate)})</span>
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
                    <Td>
                      <Link to={`/drivers/${p.driverId}`} className="font-semibold text-ink-800 hover:text-brand-700">
                        {p.driverName}
                      </Link>
                    </Td>
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

      <Modal
        open={paidTarget !== null}
        onClose={() => busyBatchId === null && setPaidTarget(null)}
        title="Mark batch as paid"
        footer={
          <>
            <Button variant="outline" onClick={() => setPaidTarget(null)} disabled={busyBatchId !== null}>
              Cancel
            </Button>
            <Button onClick={markPaid} loading={busyBatchId !== null}>
              Confirm payment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {paidTarget && (
            <p className="text-sm text-ink-600">
              Record a bank transfer of <span className="font-semibold text-ink-800">{formatCurrency(paidTarget.netPayout)}</span> to{' '}
              <span className="font-semibold text-ink-800">{paidTarget.vendorName}</span> for {formatDate(paidTarget.periodStart)} –{' '}
              {formatDate(paidTarget.periodEnd)}.
            </p>
          )}
          <Field label="Transaction reference (optional)">
            <Input
              value={paidForm.transactionRef}
              onChange={(e) => setPaidForm({ ...paidForm, transactionRef: e.target.value })}
              placeholder="UTR / NEFT reference"
            />
          </Field>
          <Field label="Bank account label (optional)">
            <Input
              value={paidForm.bankAccountLabel}
              onChange={(e) => setPaidForm({ ...paidForm, bankAccountLabel: e.target.value })}
              placeholder="HDFC ····1234"
            />
          </Field>
        </div>
      </Modal>

      <ReasonModal
        open={failedTarget !== null}
        title="Mark batch as failed"
        description={failedTarget ? `${failedTarget.vendorName} · ${formatCurrency(failedTarget.netPayout)}` : undefined}
        label="Failure reason"
        confirmLabel="Mark failed"
        busy={busyBatchId !== null}
        onClose={() => setFailedTarget(null)}
        onConfirm={markFailed}
      />
    </div>
  );
}
