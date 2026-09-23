import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Pagination({
  page,
  pageCount,
  onChange,
  total,
  pageSize,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  total: number;
  pageSize: number;
}) {
  if (pageCount <= 1) {
    return (
      <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-[13px] text-ink-500">
        <span>{total} results</span>
      </div>
    );
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3">
      <span className="text-[13px] text-ink-500">
        Showing <span className="font-medium text-ink-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-ink-700">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 disabled:opacity-40"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) => (
          <span key={p} className="flex items-center">
            {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-ink-300">…</span>}
            <button
              onClick={() => onChange(p)}
              className={cn(
                'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-medium',
                p === page ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100',
              )}
            >
              {p}
            </button>
          </span>
        ))}
        <button
          onClick={() => onChange(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 disabled:opacity-40"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
