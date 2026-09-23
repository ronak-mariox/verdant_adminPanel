import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-800 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={cn('mb-1.5 block text-[13px] font-medium text-ink-700', className)}>{children}</label>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

export function SearchInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3.5 text-sm text-ink-800 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        {...props}
      />
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
