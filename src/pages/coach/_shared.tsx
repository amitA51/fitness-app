// ============================================================================
// COACH PLATFORM — shared page primitives
// ============================================================================
// Small building blocks so the coach/trainee screens stay lean and consistent
// with the existing Fresh Steel design (CSS vars, RTL, sharp corners).

import { ChevronRight } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function CoachPage({
  title,
  subtitle,
  onBack,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const back = onBack ?? (() => navigate(-1));
  return (
    <div dir="rtl" lang="he" className="min-h-screen" style={{ background: 'var(--fs-bg)' }}>
      <header
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--fs-surface-2)' }}
      >
        <button
          type="button"
          onClick={back}
          aria-label="חזרה"
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            background: 'var(--fs-surface-2)',
            color: 'var(--fs-heading)',
          }}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <h1
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--fs-heading)',
              margin: 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </header>
      <main className="px-5 py-5" style={{ paddingBottom: 96 }}>
        {children}
      </main>
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      {title && (
        <h2
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--fs-muted)',
            marginBottom: 10,
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function ListRow({
  label,
  meta,
  onClick,
  trailing,
}: {
  label: string;
  meta?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-right"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        marginBottom: 8,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--fs-ink)',
          }}
        >
          {label}
        </div>
        {meta && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}>
            {meta}
          </div>
        )}
      </div>
      {trailing}
      {onClick && (
        <ChevronRight
          size={18}
          style={{ color: 'var(--fs-muted)', transform: 'scaleX(-1)' }}
          aria-hidden="true"
        />
      )}
    </Comp>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        color: 'var(--fs-muted)',
        textAlign: 'center',
        padding: '32px 16px',
      }}
    >
      {children}
    </p>
  );
}

/** Minimal data-loading hook: runs `fn` on mount + when `reload` is called. */
export function useAsyncData<T>(
  fn: () => Promise<T>,
  initial: T
): { data: T; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fn is captured per-render by callers; reload is driven by the tick counter
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { data, loading, error, reload };
}

export const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return '—';
  }
};
