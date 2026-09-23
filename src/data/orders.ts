import type { Order, OrderItem, OrderStatus, OrderStatusEvent } from '@/types';
import { customers } from './customers';
import { vendors } from './vendors';
import { drivers } from './drivers';
import { products } from './products';
import { createRng, pick, pickWeighted, intBetween, hoursAgo, minutesAgo } from '@/lib/rng';

const rng = createRng(2026);

const STATUS_FLOW: OrderStatus[] = [
  'placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered',
];

const statusPool: [OrderStatus, number][] = [
  ['placed', 8],
  ['accepted', 10],
  ['preparing', 10],
  ['ready_for_pickup', 9],
  ['out_for_delivery', 12],
  ['delivered', 40],
  ['cancelled', 7],
  ['rejected', 4],
];

const cancelReasons = ['Customer requested cancellation', 'Item out of stock', 'Vendor unable to fulfil', 'Duplicate order', 'Address unserviceable'];
const paymentMethods: Order['paymentMethod'][] = ['UPI', 'Card', 'Cash on Delivery', 'Wallet'];

function buildHistory(finalStatus: OrderStatus, placedMinsAgo: number): OrderStatusEvent[] {
  const history: OrderStatusEvent[] = [];
  if (finalStatus === 'cancelled' || finalStatus === 'rejected') {
    history.push({ status: 'placed', time: minutesAgo(placedMinsAgo) });
    history.push({ status: finalStatus, time: minutesAgo(Math.max(placedMinsAgo - intBetween(rng, 2, 20), 0)) });
    return history;
  }
  const endIdx = STATUS_FLOW.indexOf(finalStatus);
  const steps = endIdx === -1 ? 1 : endIdx + 1;
  for (let i = 0; i < steps; i++) {
    const t = Math.max(placedMinsAgo - Math.round((placedMinsAgo / steps) * i), 0);
    history.push({ status: STATUS_FLOW[i], time: minutesAgo(t) });
  }
  return history;
}

export const orders: Order[] = Array.from({ length: 320 }, (_, i) => {
  const customer = pick(rng, customers);
  const vendor = pick(rng, vendors);
  const status = pickWeighted(rng, statusPool);
  const itemCount = intBetween(rng, 1, 6);
  const items: OrderItem[] = Array.from({ length: itemCount }, () => {
    const p = pick(rng, products);
    const qty = intBetween(rng, 1, 4);
    return { productId: p.id, name: p.name, image: p.image, qty, price: p.sellingPrice };
  });
  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const deliveryFee = subtotal >= 199 ? 0 : 30;
  const platformFee = 5;
  const discount = pickWeighted(rng, [[0, 60], [20, 20], [40, 15], [60, 5]] as const);
  const total = Math.max(subtotal + deliveryFee + platformFee - discount, 0);
  const needsDriver = !['placed', 'cancelled', 'rejected'].includes(status);
  const driver = needsDriver ? pick(rng, drivers) : undefined;
  const placedMinsAgo = intBetween(rng, 8, 60 * 24 * 29);

  return {
    id: `ORD-${(10450 + i).toString()}`,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    vendorId: vendor.id,
    vendorName: vendor.storeName,
    driverId: driver?.id,
    driverName: driver?.name,
    items,
    itemsCount: itemCount,
    subtotal,
    deliveryFee,
    platformFee,
    discount,
    total,
    paymentMethod: pick(rng, paymentMethods),
    paymentStatus: (status === 'rejected' ? 'failed' : status === 'cancelled' ? (rng() > 0.4 ? 'refunded' : 'pending') : 'paid') as Order['paymentStatus'],
    status,
    address: `${intBetween(rng, 1, 999)}, ${pick(rng, ['Sector 62', 'Sector 18', 'DLF Phase 3', 'HSR Layout', 'Koregaon Park', 'Banjara Hills'])}`,
    city: vendor.city,
    placedAt: minutesAgo(placedMinsAgo),
    statusHistory: buildHistory(status, placedMinsAgo),
    cancelReason: status === 'cancelled' ? pick(rng, cancelReasons) : undefined,
  };
}).sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

export const orderById = (id: string) => orders.find((o) => o.id === id);

export const recentOrderTrendHours = Array.from({ length: 24 }, (_, h) => {
  const hourAgo = 23 - h;
  const count = orders.filter((o) => {
    const diffH = (Date.now() - new Date(o.placedAt).getTime()) / 3.6e6;
    return Math.floor(diffH) === hourAgo;
  }).length;
  const label = hoursAgo(hourAgo);
  return { hour: new Date(label).getHours(), orders: count };
});
