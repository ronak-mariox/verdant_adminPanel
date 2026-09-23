import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompactNumber, formatCurrency } from '@/lib/format';

interface Point {
  date: string;
  revenue: number;
  orders: number;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point: Point = payload[0].payload;
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 shadow-[var(--shadow-card-lg)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 font-display text-base font-bold text-ink-900">{formatCurrency(point.revenue)}</p>
      <p className="text-[12px] text-ink-500">{point.orders} orders</p>
    </div>
  );
}

export function RevenueTrendChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1CA672" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#1CA672" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 5" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          interval={4}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          tickFormatter={(v) => formatCompactNumber(v)}
          width={44}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#1CA672', strokeWidth: 1, strokeDasharray: '4 4' }} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#1CA672"
          strokeWidth={2.5}
          fill="url(#revenueFill)"
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
