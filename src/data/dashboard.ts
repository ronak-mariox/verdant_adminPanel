import { orders } from './orders';
import { vendors } from './vendors';
import { drivers } from './drivers';
import { customers } from './customers';
import { products } from './products';
import { categories } from './categories';

const DAY_MS = 86_400_000;

export function last30DaysRevenue() {
  const days = Array.from({ length: 30 }, (_, i) => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - (29 - i));
    return dayStart.getTime();
  });

  return days.map((dayStart) => {
    const dayEnd = dayStart + DAY_MS;
    const dayOrders = orders.filter((o) => {
      const t = new Date(o.placedAt).getTime();
      return t >= dayStart && t < dayEnd && o.status !== 'cancelled' && o.status !== 'rejected';
    });
    const revenue = dayOrders.reduce((sum, o) => sum + o.total, 0);
    return {
      date: new Date(dayStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      revenue,
      orders: dayOrders.length,
    };
  });
}

export function ordersByStatus() {
  const counts: Record<string, number> = {};
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
  return counts;
}

export function revenueByCategory() {
  const revenueByProduct = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'cancelled' || o.status === 'rejected') continue;
    for (const item of o.items) revenueByProduct.set(item.productId, (revenueByProduct.get(item.productId) ?? 0) + item.price * item.qty);
  }
  const byCategory = new Map<string, number>();
  for (const p of products) {
    const rev = revenueByProduct.get(p.id) ?? 0;
    byCategory.set(p.categoryName, (byCategory.get(p.categoryName) ?? 0) + rev);
  }
  return categories
    .map((c) => ({ name: c.name, value: byCategory.get(c.name) ?? 0 }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function topVendorsByRevenue(n = 5) {
  return [...vendors].sort((a, b) => b.revenue - a.revenue).slice(0, n);
}

export function dashboardKpis() {
  const activeOrders = orders.filter((o) => !['delivered', 'cancelled', 'rejected'].includes(o.status)).length;
  const completedOrders = orders.filter((o) => o.status === 'delivered');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const avgOrderValue = completedOrders.length ? Math.round(totalRevenue / completedOrders.length) : 0;
  const onlineDrivers = drivers.filter((d) => d.status === 'active').length;
  const pendingVendorApprovals = vendors.filter((v) => v.status === 'pending').length;
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled' || o.status === 'rejected').length;
  const cancellationRate = orders.length ? Math.round((cancelledOrders / orders.length) * 1000) / 10 : 0;

  return {
    totalRevenue,
    totalOrders: orders.length,
    activeOrders,
    avgOrderValue,
    totalVendors: vendors.length,
    activeVendors: vendors.filter((v) => v.status === 'active').length,
    pendingVendorApprovals,
    totalDrivers: drivers.length,
    onlineDrivers,
    totalCustomers: customers.length,
    cancellationRate,
  };
}
