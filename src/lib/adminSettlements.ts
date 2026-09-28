// Real backend VendorSettlement (per-order), VendorPayoutBatch (weekly) and
// aggregated driver payout shapes, used by the admin-wide Settlements & Payouts page.
import type { VendorSettlementRecord, DriverPayoutSummary, PayoutBatch, PayoutBatchStatus } from '@/types';
import { ApiError } from '@/lib/api';

export interface ApiVendorSettlement {
  id: string;
  vendorId: string;
  vendorName?: string;
  orderId: string;
  orderNumber: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  gstOnCommission: number;
  netPayout: number;
  settledAt: string;
}

export function mapVendorSettlement(s: ApiVendorSettlement): VendorSettlementRecord {
  return {
    id: s.id,
    vendorId: s.vendorId,
    vendorName: s.vendorName,
    orderId: s.orderId,
    orderNumber: s.orderNumber,
    grossAmount: s.grossAmount,
    commissionRate: s.commissionRate,
    commissionAmount: s.commissionAmount,
    gstOnCommission: s.gstOnCommission,
    netPayout: s.netPayout,
    settledAt: s.settledAt,
  };
}

// The batches endpoint is being introduced alongside this page; accept both the
// contract's field names (totalGross…) and the raw model's (grossSales…).
export interface ApiPayoutBatch {
  id: string;
  vendorId: string;
  vendorName?: string;
  periodStart: string;
  periodEnd: string;
  totalGross?: number;
  grossSales?: number;
  totalCommission?: number;
  commission?: number;
  totalGst?: number;
  gstOnCommission?: number;
  netPayout: number;
  settlementCount?: number;
  status: PayoutBatchStatus;
  paidAt?: string;
  transactionDate?: string;
  transactionRef?: string;
  failureReason?: string;
}

export function mapPayoutBatch(b: ApiPayoutBatch): PayoutBatch {
  return {
    id: b.id,
    vendorId: b.vendorId,
    vendorName: b.vendorName ?? 'Unknown vendor',
    periodStart: b.periodStart,
    periodEnd: b.periodEnd,
    totalGross: b.totalGross ?? b.grossSales ?? 0,
    totalCommission: b.totalCommission ?? b.commission ?? 0,
    totalGst: b.totalGst ?? b.gstOnCommission ?? 0,
    netPayout: b.netPayout,
    settlementCount: b.settlementCount ?? 0,
    status: b.status,
    paidAt: b.paidAt ?? b.transactionDate,
    transactionRef: b.transactionRef,
    failureReason: b.failureReason,
  };
}

export type ApiDriverPayout = DriverPayoutSummary;

export function mapDriverPayout(p: ApiDriverPayout): DriverPayoutSummary {
  return p;
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
