import { cn } from '@/lib/cn';

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl bg-ink-100/70 p-1">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium capitalize transition-colors',
            value === item.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                value === item.value ? 'bg-brand-50 text-brand-700' : 'bg-white text-ink-500',
              )}
            >
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
