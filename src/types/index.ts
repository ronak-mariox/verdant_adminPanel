// Shared domain model for the Verdant Admin panel.
// Mirrors the field conventions used across the Verdant (customer), vender_app (vendor)
// and DeliveryApp (driver) React Native apps so the same records make sense on both sides.

export type ID = string;

// ---------------------------------------------------------------------------
// Catalog: categories, subcategories, products
// ---------------------------------------------------------------------------

export type CatalogStatus = 'active' | 'inactive';

// Determines what unit/variant input the vendor app shows when adding a product
// under this subcategory (or category, as a fallback) — weight_volume for
// grocery-style g/kg/ml, attribute for discrete options like clothing sizes or
// storage capacities.
export interface CategoryVariantConfig {
  kind: 'weight_volume' | 'attribute';
  label: string;
  units?: string[];
  options?: string[];
}

export interface Subcategory {
  id: ID;
  categoryId: ID;
  name: string;
  image: string;
  productCount: number;
  status: CatalogStatus;
  // Overrides the parent category's variantConfig — e.g. Fashion's "Dresses" needs
  // clothing sizes while its "Watches" subcategory doesn't. Falls back to the
  // category's own variantConfig when unset.
  variantConfig?: CategoryVariantConfig;
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
}

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
  rating: number;
  ratingCount: number;
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
  rating: number;
  totalOrders: number;
  revenue: number;
  commissionRate: number;
  productsCount: number;
  joinedAt: string;
  gstNumber: string;
}

// ---------------------------------------------------------------------------
// Delivery partners (drivers)
// ---------------------------------------------------------------------------

// The backend has no real-time presence/session tracking (no 'online'/'offline'/
// 'on-delivery' concept) — a driver's only real server-side state is this account
// status pipeline, mirroring Vendor's. Widened additively from the old mock-only
// 'online' | 'offline' | 'on-delivery' | 'suspended' union to match backend reality
// instead of pretending to have live presence data.
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
  rating: number;
  totalDeliveries: number;
  completionRate: number;
  earningsThisMonth: number;
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
  city: string;
  status: CustomerStatus;
  totalOrders: number;
  totalSpent: number;
  joinedAt: string;
  /** Absent when the customer has no orders on record — never fabricated. */
  lastOrderAt?: string;
}

// ---------------------------------------------------------------------------
// Orders — status pipeline mirrors vender_app/src/context/OrdersContext.tsx
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
}

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
  paymentMethod: 'UPI' | 'Card' | 'Cash on Delivery' | 'Wallet';
  paymentStatus: 'paid' | 'pending' | 'refunded' | 'failed';
  status: OrderStatus;
  address: string;
  city: string;
  placedAt: string;
  statusHistory: OrderStatusEvent[];
  cancelReason?: string;
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

// ---------------------------------------------------------------------------
// Settlements / payouts
// ---------------------------------------------------------------------------

export type SettlementStatus = 'paid' | 'processing' | 'pending' | 'failed';

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
  commissionRate: number;
  commissionAmount: number;
  gstOnCommission: number;
  netPayout: number;
  settledAt: string;
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
// Vendor KYC document uploads beyond the fixed registration steps
// ---------------------------------------------------------------------------

export interface AdditionalDocumentData {
  id: ID;
  name: string;
  url: string;
  uploadedAt: string;
}

// ---------------------------------------------------------------------------
// Offers / promotions
// ---------------------------------------------------------------------------

// The backend coupon model has no "scheduled" concept (no startsAt field — a
// coupon is usable from the moment it's created), so that status is dropped here
// rather than kept as dead, unreachable UI state.
export type OfferStatus = 'active' | 'expired' | 'paused';

export interface Offer {
  id: ID;
  title: string;
  description: string;
  code: string;
  type: 'percentage' | 'flat' | 'free-delivery';
  value: number;
  minOrderValue: number;
  appliesTo: string;
  usageCount: number;
  status: OfferStatus;
  startDate: string;
  /** Absent when the coupon has no expiry (backend's `expiresAt` is optional) — never fabricated. */
  endDate?: string;
}

// ---------------------------------------------------------------------------
// Notifications / announcements sent from admin
// ---------------------------------------------------------------------------

export type NotificationAudience = 'customers' | 'vendors' | 'drivers' | 'all';

export interface AdminNotification {
  id: ID;
  title: string;
  body: string;
  audience: NotificationAudience;
  sentAt: string;
  reach: number;
}

// ---------------------------------------------------------------------------
// Support tickets / disputes
// ---------------------------------------------------------------------------

export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'escalated';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

// Real support tickets from the backend's SupportTicket model — currently only
// ever created when a driver reports a delivery issue (the only real
// dispute-raising flow that exists today), so the list may be small but is real.
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
  createdAt: string;
  updatedAt: string;
}
