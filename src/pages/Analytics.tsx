import { useMemo } from 'react';
import { IndianRupee, ShoppingBag, Receipt, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { RevenueTrendChart } from '@/components/charts/RevenueTrendChart';
import { CategoryRevenueChart } from '@/components/charts/CategoryRevenueChart';
import { dashboardKpis, last30DaysRevenue, revenueByCategory } from '@/data/dashboard';
import { vendors } from '@/data/vendors';
import { products } from '@/data/products';
import { formatCurrency } from '@/lib/format';

export function Analytics() {
  const kpis = dashboardKpis();
  const trend = last30DaysRevenue();
  const categoryRevenue = revenueByCategory();

  const topVendorsByOrders = useMemo(() => [...vendors].sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 7), []);
  const stockAlerts = useMemo(
    () => products.filter((p) => p.status === 'low-stock' || p.status === 'out-of-stock').slice(0, 8),
    [],
  );

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Deeper reporting across revenue, catalog and vendor performance" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatCurrency(kpis.totalRevenue)}
          icon={<IndianRupee size={18} />}
          iconColor="#1CA672"
          iconSurface="var(--color-brand-50)"
          trend={12.4}
          trendLabel="vs last month"
        />
        <StatCard
          label="Total orders"
          value={kpis.totalOrders}
          icon={<ShoppingBag size={18} />}
          iconColor="#3B82F6"
          iconSurface="var(--color-info-surface)"
          trend={8.1}
        />
        <StatCard
          label="Avg. order value"
          value={formatCurrency(kpis.avgOrderValue)}
          icon={<Receipt size={18} />}
          iconColor="#F79009"
          iconSurface="var(--color-warning-surface)"
          trend={-2.3}
        />
        <StatCard
          label="Cancellation rate"
          value={`${kpis.cancellationRate}%`}
          icon={<XCircle size={18} />}
          iconColor="#DC2626"
          iconSurface="var(--color-danger-surface)"
        />
      </div>

      <Card className="mt-6">
        <CardHeader title="Revenue trend" subtitle="Last 30 days, completed orders" />
        <CardBody className="pl-0 pr-4">
          <RevenueTrendChart data={trend} />
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Revenue by category" subtitle="Which catalog categories drive the most sales" />
        <CardBody>
          <CategoryRevenueChart data={categoryRevenue} />
        </CardBody>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Top vendors by orders" subtitle="Highest order volume across the platform" />
          <Table>
            <Thead>
              <Tr>
                <Th>Vendor</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Revenue</Th>
              </Tr>
            </Thead>
            <tbody>
              {topVendorsByOrders.map((v) => (
                <Tr key={v.id}>
                  <Td className="font-semibold text-ink-800">{v.storeName}</Td>
                  <Td className="text-right">{v.totalOrders.toLocaleString('en-IN')}</Td>
                  <Td className="text-right font-medium text-ink-700">{formatCurrency(v.revenue)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Stock alerts" subtitle="Products running low or out of stock" />
          {stockAlerts.length === 0 ? (
            <CardBody className="text-sm text-ink-500">No stock alerts right now.</CardBody>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Product</Th>
                  <Th>Vendor</Th>
                  <Th className="text-right">Stock</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <tbody>
                {stockAlerts.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-semibold text-ink-800">{p.name}</Td>
                    <Td className="text-ink-500">{p.vendorName}</Td>
                    <Td className="text-right">{p.stock}</Td>
                    <Td>
                      <StatusBadge status={p.status} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
