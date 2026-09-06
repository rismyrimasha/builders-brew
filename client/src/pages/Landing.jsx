import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isAdminRole } from '../lib/roles';

export default function Landing() {
  const { staffToken, staff } = useAuth();

  if (staffToken) {
    if (isAdminRole(staff?.role)) return <Navigate to="/admin" replace />;
    return <Navigate to="/staff" replace />;
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Full-bleed atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 90% 70% at 50% 15%, rgba(173, 139, 91, 0.22), transparent 55%),
            radial-gradient(ellipse 50% 40% at 80% 85%, rgba(92, 72, 48, 0.45), transparent 60%),
            radial-gradient(ellipse 40% 35% at 10% 70%, rgba(41, 34, 26, 0.9), transparent 50%),
            linear-gradient(165deg, #1a1510 0%, #14110d 45%, #0c0a08 100%)
          `,
        }}
      />

      {/* Soft steam / grain motion */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] opacity-40 animate-[soft-pulse_3.2s_ease-in-out_infinite]"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(232, 220, 199, 0.12), transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-12">
        <div className="animate-[fade-up_0.55s_ease-out]">
          <span className="plate-tag">Loyalty desk</span>
        </div>

        <h1 className="mt-6 font-display text-[clamp(3rem,12vw,5.5rem)] font-bold leading-[0.95] tracking-tight text-gold-300 animate-[fade-up_0.65s_ease-out]">
          Builders Brew
        </h1>

        <p className="mt-5 max-w-md text-lg text-cream-200 animate-[fade-up_0.75s_ease-out]">
          Counter loyalty for the café — look up members, award points, redeem rewards.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center animate-[fade-up_0.85s_ease-out]">
          <Link to="/staff/login" className="btn-gold !min-h-14 px-8 text-lg">
            Staff login
          </Link>
          <Link to="/admin/login" className="btn-ghost !min-h-14 px-8 text-lg">
            Admin login
          </Link>
        </div>
      </div>
    </div>
  );
}
