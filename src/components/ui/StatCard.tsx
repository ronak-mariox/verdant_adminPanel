import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from './Card';
import { cn } from '@/lib/cn';

export function StatCard({
  label,
  value,
  icon,
  iconColor = '#1CA672',
  iconSurface = 'var(--color-brand-50)',
  trend,
  trendLabel,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  iconColor?: string;
  iconSurface?: string;
  trend?: number;
  trendLabel?: string;
}) {
  const positive = (trend ?? 0) >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconSurface, color: iconColor }}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              positive ? 'bg-success-surface text-success' : 'bg-danger-surface text-danger',
            )}
          >
            {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-4 font-display text-2xl font-bold text-ink-900">{value}</p>
      <p className="mt-1 text-[13px] text-ink-500">
        {label}
        {trendLabel && <span className="text-ink-400"> · {trendLabel}</span>}
      </p>
    </Card>
  );
}
