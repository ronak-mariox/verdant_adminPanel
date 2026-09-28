import { NavLink, useNavigate } from 'react-router-dom';
import { Leaf, LogOut } from 'lucide-react';
import { navGroups } from './nav';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { humanizeRole, initials } from '@/lib/format';

export function Sidebar() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-200 bg-surface lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-ink-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[var(--shadow-button)]">
          <Leaf size={18} strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-bold text-ink-900">Verdant</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={17} strokeWidth={isActive ? 2.4 : 2} />
                      <span className="flex-1">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-ink-100 p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-ink-50 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {admin ? initials(admin.name) : '—'}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold text-ink-800">{admin?.name ?? 'Unknown'}</p>
            <p className="truncate text-[11px] text-ink-500">{admin ? humanizeRole(admin.role) : ''}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-200 hover:text-ink-700"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
