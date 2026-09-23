import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

/** A minimal inline error banner — same visual style as Login.tsx's error state. */
export function InlineAlert({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger-surface px-4 py-3',
        className,
      )}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
      <p className="text-[13px] font-medium text-danger">{message}</p>
    </div>
  );
}
