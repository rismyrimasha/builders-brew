export function PageShell({ children, className = '' }) {
  return (
    <div className={`mx-auto w-full max-w-lg px-4 pb-28 pt-6 ${className}`}>{children}</div>
  );
}

export function BrandMark({ size = 'md' }) {
  const sizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  };
  return (
    <div className="animate-[fade-up_0.6s_ease-out]">
      <p className={`font-display font-bold tracking-tight text-gold-300 ${sizes[size]}`}>
        Builders Brew
      </p>
    </div>
  );
}

export function PlateTag({ children }) {
  return <span className="plate-tag">{children}</span>;
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-gold-500" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ title, body }) {
  return (
    <div className="surface px-5 py-10 text-center">
      <p className="font-display text-xl text-cream-50">{title}</p>
      {body && <p className="mt-2 text-sm text-muted">{body}</p>}
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-cream-50">
      {message}
    </div>
  );
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-cream-50">
      {message}
    </div>
  );
}

export function PointsNumber({ value, className = '' }) {
  return (
    <span className={`font-display font-bold tabular-nums tracking-tight text-gold-300 ${className}`}>
      {Number(value || 0).toLocaleString()}
    </span>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/70 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md animate-[fade-up_0.25s_ease-out] rounded-2xl border border-ink-700 bg-ink-800 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl text-cream-50">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-muted hover:text-cream-50"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
