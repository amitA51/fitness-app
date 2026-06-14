// ============================================================================
// ViewModeBar — the app-level mode switch (מתאמן ⟷ מאמן).
// A slim rail at the top of the shell that flips the ACTIVE VIEW between the
// personal trainee app and the coach command-center. The whole route tree
// (guards + bottom nav) keys off `isCoachView`, so flipping here swaps every
// screen. Server role still backs permissions (RLS); this is a local preference.
//
// Rendered by AppShell only when not in an immersive workout (AppShell gates
// with !isWorkoutActive), and self-hides when `canSwitchView` is false. It
// blends into the page (no surface fill / heavy border) so it reads as a
// floating control rather than a second header stacked over the page chrome.
//
// A11y: a true single-select radiogroup (role=radio + aria-checked + roving
// tabindex + Arrow keys), a polite live-region announcement on flip, full-
// contrast labels, 44px targets, reduced-motion aware. RTL-safe (active styled
// by background, no transform math).
// ============================================================================

import { Dumbbell, type LucideIcon, Users } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoach } from '../../contexts/CoachContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { ViewMode } from '../../types/coach';
import { triggerHapticIntensity } from '../../utils/haptics';

interface Segment {
  mode: ViewMode;
  label: string;
  icon: LucideIcon;
  /** Where the user lands when entering this view, so screens swap instantly. */
  home: string;
}

const SEGMENTS: readonly Segment[] = [
  { mode: 'trainee', label: 'מתאמן', icon: Dumbbell, home: '/' },
  { mode: 'coach', label: 'מאמן', icon: Users, home: '/coach' },
] as const;

const ARROW_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']);

export function ViewModeBar() {
  const { isCoachView, canSwitchView, setViewMode } = useCoach();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [announcement, setAnnouncement] = useState('');
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Drive the active highlight from the RENDERED shell (isCoachView), never the
  // raw stored choice — so the toggle can't desync from what's on screen.
  const activeMode: ViewMode = isCoachView ? 'coach' : 'trainee';

  // Announce the mode change reactively off the RENDERED view, so the teleport
  // gets a spoken confirmation no matter what triggered the flip (this control,
  // a guard redirect, or a deep link) instead of a silent context swap. Skips
  // the initial mount so it only fires on an actual change.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setAnnouncement(isCoachView ? 'עברת לתצוגת מאמן' : 'עברת לתצוגת מתאמן');
  }, [isCoachView]);

  const select = useCallback(
    (segment: Segment) => {
      if (segment.mode === activeMode) return;
      if (!reduced) triggerHapticIntensity('medium');
      // setViewMode flips the local view synchronously (the await only covers the
      // lazy coach-mode enable), so the shell swaps immediately. The aria-live
      // announcement is driven reactively off isCoachView (effect above).
      void setViewMode(segment.mode);
      navigate(segment.home);
    },
    [activeMode, reduced, setViewMode, navigate]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (!ARROW_KEYS.has(e.key)) return;
      e.preventDefault();
      // Two-option radiogroup: any arrow moves to (and selects) the other option.
      const next = SEGMENTS[(idx + 1) % SEGMENTS.length];
      if (!next) return;
      radioRefs.current[(idx + 1) % SEGMENTS.length]?.focus();
      select(next);
    },
    [select]
  );

  if (!canSwitchView) return null;

  return (
    // Labelled region landmark so this top-of-shell control (which lives outside
    // <main>/<nav>) is still contained by a landmark (WCAG 1.3.1 / IS 5568).
    <div
      role="region"
      aria-label="מצב תצוגה"
      className="shrink-0"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        paddingBlock: 'var(--space-1)',
        paddingInline: 'var(--space-4, 16px)',
        background: 'transparent',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--fs-muted)',
        }}
      >
        תצוגה
      </span>

      <div
        role="radiogroup"
        aria-label="החלפת תצוגה בין מתאמן למאמן"
        style={{
          display: 'inline-flex',
          gap: 'var(--space-1)',
          padding: 'var(--space-1)',
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {SEGMENTS.map(({ mode, label, icon: Icon, home }, idx) => {
          const active = mode === activeMode;
          return (
            <button
              type="button"
              key={mode}
              ref={(el) => {
                radioRefs.current[idx] = el;
              }}
              role="radio"
              aria-checked={active}
              aria-label={`תצוגת ${label}`}
              tabIndex={active ? 0 : -1}
              onClick={() => select({ mode, label, icon: Icon, home })}
              onKeyDown={(e) => onKeyDown(e, idx)}
              className="active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--fs-surface)]"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 44,
                paddingInline: 'var(--space-3)',
                border: 'none',
                cursor: active ? 'default' : 'pointer',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                background: active ? 'var(--fs-primary)' : 'transparent',
                boxShadow: active ? 'var(--shadow-card)' : 'none',
                // Inactive uses full --fs-ink (AA on the surface pill); active uses
                // the mint accent on the dark primary pill.
                color: active ? 'var(--fs-accent)' : 'var(--fs-ink)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                transition: reduced
                  ? 'none'
                  : 'color 0.18s ease, background 0.18s ease, transform 0.1s ease',
              }}
            >
              <Icon size={15} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Polite announcement of the mode flip — the control's whole purpose is a
          context change, which would otherwise be silent to assistive tech. */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}

export default ViewModeBar;
