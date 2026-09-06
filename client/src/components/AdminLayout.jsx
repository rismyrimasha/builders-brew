import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { roleLabel } from '../lib/roles';
import { BrandMark } from './ui';

const links = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/rewards', label: 'Rewards' },
  { to: '/admin/staff', label: 'Staff' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/messages', label: 'Messages' },
  { to: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout() {
  const { staff, clearStaffSession } = useAuth();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-ink-700 bg-ink-900/80 lg:border-b-0 lg:border-r">
        <div className="px-5 py-5">
          <BrandMark size="sm" />
          <p className="mt-1 text-xs text-muted">{roleLabel(staff?.role)} · {staff?.name}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-ink-800 text-gold-300'
                    : 'text-muted hover:bg-ink-800/60 hover:text-cream-200'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-3 pb-5 lg:block">
          <NavLink to="/staff" className="btn-ghost mb-2 w-full text-sm">
            Counter view
          </NavLink>
          <button type="button" className="btn-ghost w-full text-sm" onClick={clearStaffSession}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
