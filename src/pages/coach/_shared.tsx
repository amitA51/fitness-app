// ============================================================================
// COACH PLATFORM — shared page primitives
// ============================================================================
// Thin layout helpers (page shell, section heading, list row) plus the small
// cross-screen building blocks the coach/trainee surfaces need. Inner controls
// (inputs, textareas, buttons, empty/loading states) come from the GLOBAL UI
// kit — these helpers carry layout only, never bespoke form controls.

import { ChevronRight } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { SkeletonBox } from '../../components/ui/SkeletonLoader';

export function CoachPage({
  title,
  subtitle,
  onBack,
  hideBack = false,
  actions,
  children,
}: {
  title: string;
  /** ReactNode so callers can pass LTR-isolated numeric subtitles (e.g. a
   *  `<bdi dir="ltr">{used}/{limit}</bdi> מושבים` seat count) without bidi reorder. */
  subtitle?: React.ReactNode;
  onBack?: () => void;
  /** Root tab screens (coach home) have no "back" — hide the chevron. */
  hideBack?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const back = onBack ?? (() => navigate(-1));
  return (
    <div
      dir="rtl"
      lang="he"
      className="min-h-screen min-h-[100dvh]"
      style={{ background: 'var(--fs-bg)' }}
    >
      <header
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--fs-surface-2)' }}
      >
        {/* 44×44 back control with focus ring (foundation Button, icon size). */}
        {!hideBack && (
          <Button variant="ghost" size="icon" onClick={back} aria-label="חזרה" className="shrink-0">
            {/* In RTL the chevron points back (toward the inline-start the user came from). */}
            <ChevronRight size={20} aria-hidden="true" />
          </Button>
        )}
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
      <div className="px-5 py-5" style={{ paddingBottom: 96 }}>
        {children}
      </div>
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
  metaNode,
  onClick,
  trailing,
}: {
  label: string;
  meta?: string;
  /** Optional JSX rendered beneath the string meta line (e.g. macro details with dir="ltr" spans). */
  metaNode?: React.ReactNode;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-right${
        onClick
          ? ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-0'
          : ''
      }`}
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        marginBottom: 8,
        minHeight: 44,
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
          {/* bdi: labels are often user-generated (client/group names) and may be Latin inside the RTL layout */}
          <bdi>{label}</bdi>
        </div>
        {meta && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}>
            {meta}
          </div>
        )}
        {metaNode}
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

/**
 * Accessible checkbox — native `<input type="checkbox">` (keeps Space/Enter,
 * focus, and form semantics) visually replaced by a token-styled box, wrapped
 * in a `<label>` so the whole 44px-tall row is a hit target and the text is
 * programmatically associated. The native control is positioned over the box
 * (not `display:none`) so the focus ring tracks it.
 */
export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-3 px-4 mb-1.5"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      <span className="relative inline-flex shrink-0" style={{ width: 22, height: 22 }}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
          style={{ width: 22, height: 22 }}
        />
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--fs-accent)] peer-focus-visible:ring-offset-1"
          style={{
            width: 22,
            height: 22,
            border: '2px solid var(--fs-surface-2)',
            background: checked ? 'var(--fs-primary)' : 'var(--fs-surface)',
            color: 'var(--fs-accent)',
            transition: 'background 120ms ease, border-color 120ms ease',
          }}
        >
          {checked && (
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2 6.2 4.6 9 10 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--fs-ink)' }}>
        {label}
      </span>
    </label>
  );
}

/** Shimmer placeholder rows matching ListRow height — the single coach loading pattern. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="טוען" className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count placeholders, never reordered
        <SkeletonBox key={i} height={56} width="100%" />
      ))}
    </div>
  );
}

/**
 * Inline load-failure state for a coach Section: distinct from the empty state,
 * with an explicit Hebrew message and a retry path. Proportional to InlineEmpty
 * (no full-screen illustration); tokenized for light + dark. Render this when a
 * useAsyncData `error` is set, BEFORE the empty branch — otherwise a failed load
 * masquerades as "no data".
 */
export function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 text-center"
      style={{
        padding: '20px 16px',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--fs-muted)',
          lineHeight: 1.6,
        }}
      >
        לא ניתן לטעון את הנתונים. בדוק את החיבור לאינטרנט ונסה שוב.
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        נסה שוב
      </Button>
    </div>
  );
}

/**
 * Compact in-page placeholder for DENSE stacked sub-sections (e.g. ClientDetail's
 * six data lists, where a brand-new client would otherwise show six large
 * illustrated empties). Page-level / primary empties use the global
 * <EmptyState> with an illustration; this is the proportional inline variant.
 */
export function InlineEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        color: 'var(--fs-muted)',
        textAlign: 'center',
        padding: '20px 16px',
      }}
    >
      {children}
    </p>
  );
}

/**
 * Minimal data-loading hook: runs `fn` on mount, when `reload` is called, and
 * whenever any value in `deps` changes. Pass `deps` for a parameterised fetch
 * (e.g. a date range) so changing an input actually re-fetches instead of
 * showing stale data from the first render.
 */
export function useAsyncData<T>(
  fn: () => Promise<T>,
  initial: T,
  deps: readonly unknown[] = []
): { data: T; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fn is captured per-render by callers; refetch is driven by the tick counter and the caller-supplied deps
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
  }, [tick, ...deps]);

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
