import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'brand' | 'info' | 'warning' | 'danger' | 'success' | 'violet' | 'orange' | 'teal' | 'indigo' | 'neutral';

const toneClasses: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700',
  info: 'bg-info-surface text-info',
  warning: 'bg-warning-surface text-warning',
  danger: 'bg-danger-surface text-danger',
  success: 'bg-success-surface text-success',
  violet: 'bg-violet-surface text-violet',
  orange: 'bg-orange-surface text-orange',
  teal: 'bg-teal-surface text-teal',
  indigo: 'bg-indigo-surface text-indigo',
  neutral: 'bg-ink-100 text-ink-600',
};

export function Badge({
  tone = 'neutral',
  dot,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// Every status value the backend actually produces: orders, vendor/driver/customer
// accounts, KYC + step reviews, products (incl. stock-derived), coupons, payout
// batches, driver payout buckets, support tickets and incentives.
const STATUS_TONE: Record<string, Tone> = {
  placed: 'info',
  accepted: 'violet',
  preparing: 'orange',
  ready_for_pickup: 'teal',
  out_for_delivery: 'indigo',
  delivered: 'success',
  cancelled: 'neutral',
  failed: 'danger',
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  rejected: 'danger',
  verified: 'success',
  blocked: 'danger',
  paid: 'success',
  processing: 'info',
  expired: 'neutral',
  paused: 'warning',
  draft: 'neutral',
  inactive: 'neutral',
  'low-stock': 'warning',
  'out-of-stock': 'danger',
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  escalated: 'danger',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  const text = label ?? status.replace(/[-_]/g, ' ');
  return (
    <Badge tone={tone} dot className="capitalize">
      {text}
    </Badge>
  );
}
