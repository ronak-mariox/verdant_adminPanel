// Real backend VendorSettlement (per-order) + aggregated driver payout shapes,
// used by the admin-wide Settlements & Payouts page.
import type { VendorSettlementRecord, DriverPayoutSummary } from '@/types';
import { ApiError } from '@/lib/api';

export interface ApiVendorSettlement {
  id: string;
  vendorId: string;
  vendorName: string;
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

export type ApiDriverPayout = DriverPayoutSummary;

export function mapDriverPayout(p: ApiDriverPayout): DriverPayoutSummary {
  return p;
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
