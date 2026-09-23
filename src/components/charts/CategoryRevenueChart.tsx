import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompactNumber, formatCurrency } from '@/lib/format';

// Validated CVD-safe categorical order (dataviz skill default palette) — passes the
// adjacent-pair gate used by bar charts up to all 8 slots.
const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

interface Datum {
  name: string;
  value: number;
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: Datum = payload[0].payload;
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 shadow-[var(--shadow-card-lg)]">
      <p className="text-[12px] font-semibold text-ink-800">{d.name}</p>
      <p className="mt-0.5 font-display text-sm font-bold text-ink-900">{formatCurrency(d.value)}</p>
    </div>
  );
}

export function CategoryRevenueChart({ data }: { data: Datum[] }) {
  const height = Math.max(data.length * 40, 200);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} stroke="#E5E7EB" strokeDasharray="3 5" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={150}
          tick={{ fill: '#374151', fontSize: 12.5 }}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F3F4F6' }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={18}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v) => (typeof v === 'number' ? formatCompactNumber(v) : v)}
            style={{ fill: '#4B5563', fontSize: 11.5, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
