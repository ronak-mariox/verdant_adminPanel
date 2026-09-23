import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Leaf, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { navGroups } from './nav';
import { cn } from '@/lib/cn';

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />

      {/* Mobile nav drawer */}
      <div className={cn('fixed inset-0 z-40 lg:hidden', mobileOpen ? '' : 'pointer-events-none')}>
        <div
          className={cn('absolute inset-0 bg-ink-900/40 transition-opacity', mobileOpen ? 'opacity-100' : 'opacity-0')}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            'absolute left-0 top-0 flex h-full w-72 flex-col bg-surface shadow-2xl transition-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-ink-100 px-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Leaf size={16} />
              </div>
              <p className="font-display text-[15px] font-bold text-ink-900">Verdant Admin</p>
            </div>
            <button onClick={() => setMobileOpen(false)} className="p-1.5 text-ink-400">
              <X size={20} />
            </button>
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
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium',
                          isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100',
                        )
                      }
                    >
                      <item.icon size={17} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>

      <div className="lg:pl-64">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
