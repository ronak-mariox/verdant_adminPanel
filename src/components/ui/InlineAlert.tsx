import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

/** A minimal inline banner — danger by default (same look as Login.tsx's error state). */
export function InlineAlert({
  message,
  tone = 'danger',
  className,
}: {
  message: string;
  tone?: 'danger' | 'warning';
  className?: string;
}) {
  const danger = tone === 'danger';
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3',
        danger ? 'border-danger/20 bg-danger-surface' : 'border-warning/30 bg-warning-surface',
        className,
      )}
    >
      {danger ? (
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
      ) : (
        <Info size={16} className="mt-0.5 shrink-0 text-warning" />
      )}
      <p className={cn('text-[13px] font-medium', danger ? 'text-danger' : 'text-ink-700')}>{message}</p>
    </div>
  );
}
