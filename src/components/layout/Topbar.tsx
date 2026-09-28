import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LifeBuoy, LogOut, Menu } from 'lucide-react';
import { SearchInput } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { humanizeRole, initials, timeAgo } from '@/lib/format';
import { fetchAllPaginated } from '@/lib/api';
import { mapTicket, type ApiSupportTicket } from '@/lib/adminSupport';
import type { SupportTicketRecord } from '@/types';
import { cn } from '@/lib/cn';

const RAISED_BY_TONE: Record<string, 'brand' | 'violet' | 'indigo'> = {
  customer: 'brand',
  vendor: 'violet',
  driver: 'indigo',
};

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [open, escalated] = await Promise.all([
          fetchAllPaginated<ApiSupportTicket>('/admin/support-tickets', { status: 'open' }),
          fetchAllPaginated<ApiSupportTicket>('/admin/support-tickets', { status: 'escalated' }),
        ]);
        if (cancelled) return;
        const all = [...open, ...escalated].map(mapTicket).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        setTickets(all);
      } catch {
        // Silently ignore — the bell is a convenience surface, not critical UI.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/orders?search=${encodeURIComponent(q)}` : '/orders');
    setQuery('');
  }

  const openTickets = tickets.length;
  const recentTickets = tickets.slice(0, 5);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-ink-200 bg-surface/95 px-4 backdrop-blur sm:px-6">
      <button onClick={onMenuClick} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden">
        <Menu size={20} />
      </button>

      <form className="min-w-0 flex-1 md:w-72 md:flex-none" onSubmit={handleSearch}>
        <SearchInput
          placeholder="Search orders by number, customer or vendor…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <div className="flex-1" />

      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="relative rounded-xl border border-ink-200 p-2.5 text-ink-500 hover:bg-ink-100"
        >
          <Bell size={18} />
          {openTickets > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {openTickets}
            </span>
          )}
        </button>

        <div
          className={cn(
            'absolute right-0 top-11 w-80 origin-top-right rounded-xl border border-ink-200 bg-surface shadow-[var(--shadow-card)] transition-all',
            notifOpen ? 'visible scale-100 opacity-100' : 'invisible scale-95 opacity-0',
          )}
        >
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="text-[13px] font-semibold text-ink-800">Open support tickets</p>
            <p className="text-[11px] text-ink-500">{openTickets} open or escalated</p>
          </div>

          {recentTickets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <LifeBuoy size={20} className="text-ink-300" />
              <p className="text-[12px] text-ink-400">No open tickets right now</p>
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto">
              {recentTickets.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/support"
                    onClick={() => setNotifOpen(false)}
                    className="flex flex-col gap-1 px-4 py-2.5 hover:bg-ink-100"
                  >
                    <span className="truncate text-[13px] font-medium text-ink-800">{t.subject}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
                      <Badge tone={RAISED_BY_TONE[t.raisedByType]} className="capitalize">
                        {t.raisedByType}
                      </Badge>
                      {t.raisedByName} · {timeAgo(t.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/support"
            onClick={() => setNotifOpen(false)}
            className="block border-t border-ink-100 px-4 py-2.5 text-center text-[12px] font-semibold text-brand-700 hover:bg-ink-100"
          >
            View all tickets
          </Link>
        </div>
      </div>

      <div className="relative hidden sm:block" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
        >
          {admin ? initials(admin.name) : '—'}
        </button>

        <div
          className={cn(
            'absolute right-0 top-11 w-52 origin-top-right rounded-xl border border-ink-200 bg-surface py-1.5 shadow-[var(--shadow-card)] transition-all',
            menuOpen ? 'visible scale-100 opacity-100' : 'invisible scale-95 opacity-0',
          )}
        >
          <div className="border-b border-ink-100 px-3.5 py-2.5 leading-tight">
            <p className="truncate text-[13px] font-semibold text-ink-800">{admin?.name ?? 'Unknown'}</p>
            <p className="truncate text-[11px] text-ink-500">{admin ? humanizeRole(admin.role) : ''}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          >
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
