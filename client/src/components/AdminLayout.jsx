import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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

const navLinkClass = ({ isActive }) =>
  `block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-ink-800 text-gold-300'
      : 'text-muted hover:bg-ink-800/60 hover:text-cream-200'
  }`;

export default function AdminLayout() {
  const { staff, clearStaffSession } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // While the mobile menu is open: close on Escape, lock background scroll.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  const identity = (
    <p className="mt-1 text-xs text-muted">
      {roleLabel(staff?.role)} · {staff?.name}
    </p>
  );

  const sessionButtons = (
    <>
      <NavLink to="/staff" className="btn-ghost w-full text-sm">
        Counter view
      </NavLink>
      <button type="button" className="btn-ghost w-full text-sm" onClick={clearStaffSession}>
        Sign out
      </button>
    </>
  );

  const navList = (
    <nav className="flex flex-col gap-1">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClass}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      {/* ---- Mobile / tablet: top bar + collapsible menu ---- */}
      <div className="sticky top-0 z-40 lg:hidden">
        <header className="flex items-center justify-between gap-3 border-b border-ink-700 bg-ink-900/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <BrandMark size="sm" />
            {identity}
          </div>
          <button
            type="button"
            className="btn-ghost !min-h-11 shrink-0 !px-3 text-lg"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </header>

        {menuOpen && (
          <div className="max-h-[calc(100dvh-4.25rem)] overflow-y-auto border-b border-ink-700 bg-ink-900 p-3 shadow-xl">
            {navList}
            <div className="mt-3 flex flex-col gap-2 border-t border-ink-700 pt-3">
              {sessionButtons}
            </div>
          </div>
        )}
      </div>

      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-ink-950/60 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ---- Desktop: fixed left sidebar ---- */}
      <aside className="hidden border-r border-ink-700 bg-ink-900/80 lg:flex lg:flex-col">
        <div className="px-5 py-5">
          <BrandMark size="sm" />
          {identity}
        </div>
        <div className="flex-1 px-3">{navList}</div>
        <div className="flex flex-col gap-2 px-3 pb-5">{sessionButtons}</div>
      </aside>

      <main className="px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
