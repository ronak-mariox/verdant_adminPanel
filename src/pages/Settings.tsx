import { ShieldCheck, Wallet, Bike, ShoppingBag } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate, formatPercent, humanizeRole } from '@/lib/format';
import {
  DELIVERY_FEE,
  DRIVER_BASE_PAY,
  DRIVER_ON_TIME_BONUS,
  DRIVER_ON_TIME_WINDOW_MINUTES,
  DRIVER_PER_KM_RATE,
  GST_ON_COMMISSION_RATE,
  MIN_ORDER_VALUE,
  PLATFORM_COMMISSION_RATE,
  PLATFORM_FEE,
} from '@/lib/platform';

interface ConfigRow {
  label: string;
  value: string;
  hint?: string;
}

const COMMISSION_ROWS: ConfigRow[] = [
  {
    label: 'Platform commission',
    value: formatPercent(PLATFORM_COMMISSION_RATE),
    hint: 'Charged on the items total of every delivered order',
  },
  {
    label: 'GST on commission',
    value: formatPercent(GST_ON_COMMISSION_RATE),
    hint: 'Deducted from the vendor payout alongside the commission',
  },
];

const ORDER_ROWS: ConfigRow[] = [
  { label: 'Minimum order value', value: formatCurrency(MIN_ORDER_VALUE), hint: 'Orders below this amount pay the delivery fee' },
  { label: 'Delivery fee', value: formatCurrency(DELIVERY_FEE), hint: 'Waived once the items total meets the minimum order value' },
  { label: 'Platform fee', value: formatCurrency(PLATFORM_FEE), hint: 'Flat fee added to every order' },
];

const DRIVER_ROWS: ConfigRow[] = [
  { label: 'Base pay per delivery', value: formatCurrency(DRIVER_BASE_PAY) },
  { label: 'Distance bonus', value: `${formatCurrency(DRIVER_PER_KM_RATE)} / km`, hint: 'Vendor-to-customer distance, when both have coordinates' },
  {
    label: 'On-time bonus',
    value: formatCurrency(DRIVER_ON_TIME_BONUS),
    hint: `Delivered within ${DRIVER_ON_TIME_WINDOW_MINUTES} minutes of pickup`,
  },
];

function ConfigList({ rows }: { rows: ConfigRow[] }) {
  return (
    <dl className="divide-y divide-ink-100">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
          <div>
            <dt className="text-sm font-medium text-ink-800">{row.label}</dt>
            {row.hint && <dd className="mt-0.5 text-[12.5px] text-ink-500">{row.hint}</dd>}
          </div>
          <dd className="shrink-0 font-display text-base font-bold text-ink-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Settings() {
  const { admin } = useAuth();

  return (
    <div>
      <PageHeader title="Platform Config" subtitle="Rates and fees the backend applies to every order, plus your admin profile" />

      <InlineAlert
        tone="warning"
        message="These values are fixed in the backend's configuration and cannot be edited from the admin panel."
        className="mb-5"
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Wallet size={16} className="text-brand-700" /> Commission
                </span>
              }
              subtitle="How vendor payouts are computed from delivered orders"
            />
            <CardBody>
              <ConfigList rows={COMMISSION_ROWS} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-brand-700" /> Order pricing
                </span>
              }
              subtitle="Fees applied at checkout"
            />
            <CardBody>
              <ConfigList rows={ORDER_ROWS} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Bike size={16} className="text-brand-700" /> Driver earnings
                </span>
              }
              subtitle="What a delivery partner earns per completed delivery"
            />
            <CardBody>
              <ConfigList rows={DRIVER_ROWS} />
            </CardBody>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand-700" /> Your profile
              </span>
            }
            subtitle="The admin account for this session"
          />
          <CardBody>
            {admin ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar name={admin.name} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-display text-[15px] font-semibold text-ink-900">{admin.name}</p>
                    <p className="truncate text-[13px] text-ink-500">{admin.email}</p>
                  </div>
                </div>
                <dl className="divide-y divide-ink-100 text-sm">
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-ink-500">Role</dt>
                    <dd>
                      <Badge tone="brand">{humanizeRole(admin.role)}</Badge>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-ink-500">Admin since</dt>
                    <dd className="font-medium text-ink-800">{formatDate(admin.createdAt)}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-sm text-ink-500">Not signed in.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
