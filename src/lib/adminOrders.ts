// Shared backend-order shape + mapping logic used by both Orders.tsx (list) and
// OrderDetail.tsx (detail view) so the two pages agree on how a real /admin/orders
// record is turned into the admin panel's local Order type.
import type { Order, OrderItem, OrderStatus, OrderStatusEvent, PaymentMethod } from '@/types';
import { ApiError } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/asset';

export interface ApiOrderItem {
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  imageUrl?: string;
  price: number;
  mrp: number;
  quantity: number;
  subtotal: number;
}

export interface ApiOrderAddress {
  contactName?: string;
  contactPhone?: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface ApiOrderPricing {
  itemsTotal: number;
  taxTotal: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  grandTotal: number;
}

export interface ApiOrderStatusEvent {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  vendorId: string;
  driverId?: string;
  items: ApiOrderItem[];
  address: ApiOrderAddress;
  pricing: ApiOrderPricing;
  couponCode?: string;
  paymentMethod: 'cod' | 'online';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  status: OrderStatus;
  statusHistory: ApiOrderStatusEvent[];
  specialInstructions?: string;
  cancelReason?: string;
  cancelledBy?: 'customer' | 'vendor' | 'admin' | 'driver';
  placedAt: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface ApiCustomer {
  id: string;
  phone: string;
  name?: string;
}

export interface ApiVendor {
  id: string;
  phone: string;
  fullName?: string;
  city?: string;
  businessInfo?: { displayName?: string; city?: string };
  storeProfile?: { storeName?: string };
  storeSetupAddress?: { city?: string };
}

export interface ApiDriver {
  id: string;
  phone: string;
  fullName?: string;
}

export function vendorDisplayName(v: ApiVendor): string {
  return v.storeProfile?.storeName || v.businessInfo?.displayName || v.fullName || v.phone;
}

export function vendorCity(v: ApiVendor): string {
  return v.storeSetupAddress?.city || v.businessInfo?.city || v.city || '—';
}

function formatAddress(address: ApiOrderAddress): string {
  return [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ');
}

const PAYMENT_METHOD_LABEL: Record<ApiOrder['paymentMethod'], PaymentMethod> = {
  cod: 'Cash on Delivery',
  online: 'Online',
};

const EMPTY_DRIVERS = new Map<string, ApiDriver>();

export function mapOrder(
  o: ApiOrder,
  customerById: Map<string, ApiCustomer>,
  vendorById: Map<string, ApiVendor>,
  driverById: Map<string, ApiDriver> = EMPTY_DRIVERS,
): Order {
  const customer = customerById.get(o.customerId);
  const vendor = vendorById.get(o.vendorId);
  const driver = o.driverId ? driverById.get(o.driverId) : undefined;

  const items: OrderItem[] = o.items.map((item) => ({
    productId: item.productId,
    name: item.name,
    image: item.imageUrl ? resolveAssetUrl(item.imageUrl) : '',
    qty: item.quantity,
    price: item.price,
  }));

  const statusHistory: OrderStatusEvent[] = o.statusHistory.map((event) => ({
    status: event.status,
    time: event.at,
    note: event.note,
  }));

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    customerName: customer?.name || customer?.phone || o.address.contactName || 'Unknown customer',
    customerPhone: customer?.phone ?? o.address.contactPhone ?? '—',
    vendorId: o.vendorId,
    vendorName: vendor ? vendorDisplayName(vendor) : 'Unknown vendor',
    driverId: o.driverId,
    driverName: driver ? driver.fullName || driver.phone : undefined,
    items,
    itemsCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: o.pricing.itemsTotal,
    deliveryFee: o.pricing.deliveryFee,
    platformFee: o.pricing.platformFee,
    discount: o.pricing.discount,
    total: o.pricing.grandTotal,
    paymentMethod: PAYMENT_METHOD_LABEL[o.paymentMethod] ?? 'Cash on Delivery',
    paymentStatus: o.paymentStatus,
    status: o.status,
    address: formatAddress(o.address),
    city: o.address.city,
    placedAt: o.placedAt,
    statusHistory,
    cancelReason: o.cancelReason,
    cancelledBy: o.cancelledBy,
  };
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
