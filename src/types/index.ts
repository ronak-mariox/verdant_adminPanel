// Shared domain model for the Verdant Admin panel.
// Mirrors the field conventions used across the Verdant (customer), vender_app (vendor)
// and DeliveryApp (driver) React Native apps so the same records make sense on both sides.

export type ID = string;

// ---------------------------------------------------------------------------
// Catalog: categories, subcategories, products
// ---------------------------------------------------------------------------

export type CatalogStatus = 'active' | 'inactive';

export type VariantKind = 'weight_volume' | 'attribute' | 'none';

// Determines what unit/variant input the vendor app shows when adding a product
// under this subcategory (or category, as a fallback) — weight_volume for
// grocery-style g/kg/ml, attribute for discrete options like clothing sizes or
// storage capacities, none for items sold as a single piece (e.g. earbuds).
export interface CategoryVariantConfig {
  kind: VariantKind;
  label: string;
  units?: string[];
  options?: string[];
  /** Vendors may type a value that isn't in `options` (attribute kind only). */
  allowCustom?: boolean;
}

export interface Subcategory {
  id: ID;
  categoryId: ID;
  name: string;
  /** Empty when the backend has no image on file — render a neutral placeholder. */
  image: string;
  status: CatalogStatus;
  // Overrides the parent category's variantConfig — e.g. Fashion's "Dresses" needs
  // clothing sizes while its "Watches" subcategory doesn't. Falls back to the
  // category's own variantConfig when unset.
  variantConfig?: CategoryVariantConfig;
  variantConfigs?: CategoryVariantConfig[];
}

export interface Category {
  id: ID;
  name: string;
  image: string;
  colorFrom: string;
  colorTo: string;
  order: number;
  status: CatalogStatus;
  showOnHome: boolean;
  subcategories: Subcategory[];
  variantConfig?: CategoryVariantConfig;
  /** Every variant type a product here may use — the vendor picks one per product. */
  variantConfigs?: CategoryVariantConfig[];
}

/** Backend product status, plus two stock-derived states for active products. */
export type ProductStatus =
  | 'active'
  | 'pending'
  | 'low-stock'
  | 'out-of-stock'
  | 'rejected'
  | 'draft'
  | 'inactive';

export interface Product {
  id: ID;
  name: string;
  brand: string;
  image: string;
  categoryId: ID;
  categoryName: string;
  subcategoryId: ID;
  subcategoryName: string;
  vendorId: ID;
  vendorName: string;
  mrp: number;
  sellingPrice: number;
  unit: string;
  stock: number;
  reorderLevel: number;
  sku: string;
  gstRate: number;
  status: ProductStatus;
  rejectionReason?: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

export type VendorStatus = 'active' | 'pending' | 'suspended' | 'rejected';
export type KycStatus = 'verified' | 'pending' | 'rejected';

export interface Vendor {
  id: ID;
  storeName: string;
  ownerName: string;
  email: string;
  phone: string;
  avatarColor: string;
  category: string;
  city: string;
  address: string;
  status: VendorStatus;
  kycStatus: KycStatus;
  /** Raw wizard step — 'submitted' means the application is ready for review. */
  registrationStep: string;
  rejectionReason?: string;
  joinedAt: string;
  gstNumber: string;
}

// ---------------------------------------------------------------------------
// Delivery partners (drivers)
// ---------------------------------------------------------------------------

// The backend has no real-time presence/session tracking — a driver's only real
// server-side state is this account status pipeline, mirroring Vendor's.
export type DriverStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface Driver {
  id: ID;
  name: string;
  phone: string;
  email: string;
  avatarColor: string;
  vehicleType: 'bicycle' | 'motorbike' | 'scooter' | 'other';
  vehicleNumber: string;
  zone: string;
  status: DriverStatus;
  kycStatus: KycStatus;
  registrationStep: string;
  rejectionReason?: string;
  joinedAt: string;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type CustomerStatus = 'active' | 'blocked';

export interface Customer {
  id: ID;
  name: string;
  email: string;
  phone: string;
  avatarColor: string;
  status: CustomerStatus;
  joinedAt: string;
}

// ---------------------------------------------------------------------------
// Orders — status pipeline mirrors backend/src/lib/orderStatus.ts
// ---------------------------------------------------------------------------

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export interface OrderItem {
  productId: ID;
  name: string;
  image: string;
  qty: number;
  price: number;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  time: string;
  note?: string;
}

export type PaymentMethod = 'Cash on Delivery' | 'Online';

export interface Order {
  id: ID;
  /** Human-readable order code (e.g. "ORD-10450") — the backend's `id` is a raw Mongo id used for routing/API calls. */
  orderNumber?: string;
  customerId: ID;
  customerName: string;
  customerPhone: string;
  vendorId: ID;
  vendorName: string;
  driverId?: ID;
  driverName?: string;
  items: OrderItem[];
  itemsCount: number;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'paid' | 'pending' | 'refunded' | 'failed';
  status: OrderStatus;
  address: string;
  city: string;
  placedAt: string;
  statusHistory: OrderStatusEvent[];
  cancelReason?: string;
  cancelledBy?: string;
}

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; surface: string }
> = {
  placed: { label: 'Placed', color: 'var(--color-info)', surface: 'var(--color-info-surface)' },
  accepted: { label: 'Accepted', color: 'var(--color-violet)', surface: 'var(--color-violet-surface)' },
  preparing: { label: 'Preparing', color: 'var(--color-orange)', surface: 'var(--color-orange-surface)' },
  ready_for_pickup: { label: 'Ready for Pickup', color: 'var(--color-teal)', surface: 'var(--color-teal-surface)' },
  out_for_delivery: { label: 'Out for Delivery', color: 'var(--color-indigo)', surface: 'var(--color-indigo-surface)' },
  delivered: { label: 'Delivered', color: 'var(--color-success)', surface: 'var(--color-success-surface)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-ink-500)', surface: 'var(--color-ink-100)' },
  rejected: { label: 'Rejected', color: 'var(--color-danger)', surface: 'var(--color-danger-surface)' },
};

/** Admin-allowed transitions, mirroring backend/src/lib/orderStatus.ts (actor = admin). */
export const ADMIN_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'ready_for_pickup', 'cancelled'],
  delivered: [],
  cancelled: [],
  rejected: [],
};

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'rejected'];

// ---------------------------------------------------------------------------
// Settlements / payouts
// ---------------------------------------------------------------------------

// Real, per-order settlement records from `VendorSettlement` on the backend —
// created once an order is marked delivered. `vendorName` is only populated by
// the admin-wide `/admin/settlements/vendors` listing (Settlements.tsx); the
// per-vendor `/admin/vendors/:id/settlements` endpoint (VendorDetail.tsx) omits
// it since the vendor is already known there.
export interface VendorSettlementRecord {
  id: ID;
  vendorId: ID;
  vendorName?: string;
  orderId: ID;
  orderNumber: string;
  grossAmount: number;
  /** A fraction (0.08 = 8%). */
  commissionRate: number;
  commissionAmount: number;
  gstOnCommission: number;
  netPayout: number;
  settledAt: string;
}

export type PayoutBatchStatus = 'pending' | 'paid' | 'failed';

/** Weekly vendor payout batch (`VendorPayoutBatch`) — the only place a "paid" state is tracked. */
export interface PayoutBatch {
  id: ID;
  vendorId: ID;
  vendorName: string;
  periodStart: string;
  periodEnd: string;
  totalGross: number;
  totalCommission: number;
  totalGst: number;
  netPayout: number;
  settlementCount: number;
  status: PayoutBatchStatus;
  paidAt?: string;
  transactionRef?: string;
  failureReason?: string;
}

// Real, aggregated-per-driver payout summary from the backend's EarningsLedger —
// there's no bank-transfer tracking in the app, so `status` is derived purely
// from the real pending/settled/paid ledger buckets, never fabricated.
export interface DriverPayoutSummary {
  driverId: ID;
  driverName: string;
  deliveries: number;
  pendingAmount: number;
  settledAmount: number;
  paidAmount: number;
  totalEarnings: number;
  status: 'pending' | 'processing' | 'paid';
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Driver incentives (`Incentive` model)
// ---------------------------------------------------------------------------

export type IncentiveStatus = 'active' | 'expired';

export interface IncentiveCondition {
  label: string;
  type: string;
  threshold: number;
}

export interface Incentive {
  id: ID;
  title: string;
  description: string;
  rewardAmount: number;
  targetDeliveries: number;
  startAt: string;
  expiresAt: string;
  status: IncentiveStatus;
  conditions: IncentiveCondition[];
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Vendor bank-details change requests — a vendor's live `bankDetails` never
// updates directly; a change request sits here until an admin approves/rejects it.
// ---------------------------------------------------------------------------

export type BankDetailsRequestStatus = 'pending' | 'approved' | 'rejected';

export interface BankDetailsFields {
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  branch?: string;
  accountType?: string;
  upiId?: string;
}

export interface PendingBankDetails {
  data: BankDetailsFields;
  status: BankDetailsRequestStatus;
  submittedAt: string;
  reviewNote?: string;
  reviewedAt?: string;
}

// ---------------------------------------------------------------------------
// Offers / promotions (backend `Coupon`)
// ---------------------------------------------------------------------------

// The backend coupon model has no "scheduled" concept (no startsAt field — a
// coupon is usable from the moment it's created), so that status is dropped here
// rather than kept as dead, unreachable UI state.
export type OfferStatus = 'active' | 'expired' | 'paused';

export interface Offer {
  id: ID;
  description: string;
  code: string;
  type: 'percentage' | 'flat';
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  status: OfferStatus;
  startDate: string;
  /** Absent when the coupon has no expiry (backend's `expiresAt` is optional) — never fabricated. */
  endDate?: string;
}

// ---------------------------------------------------------------------------
// Support tickets / disputes
// ---------------------------------------------------------------------------

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'escalated';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TicketNote {
  text: string;
  at: string;
}

export interface SupportTicketRecord {
  id: ID;
  subject: string;
  raisedByName: string;
  raisedByType: 'customer' | 'vendor' | 'driver';
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  description?: string;
  orderId?: ID;
  notes: TicketNote[];
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}
