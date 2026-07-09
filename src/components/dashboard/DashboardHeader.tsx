import { m } from 'framer-motion';
import { Settings } from 'lucide-react';
import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { greeting } from '../../utils/dateUtils';
import { safeJsonParse } from '../../utils/safeJson';
import { parseUserProfile } from '../../utils/validation';

interface DashboardHeaderProps {
  hasSessionToday?: boolean;
}

export const DashboardHeader = memo(function DashboardHeader({
  hasSessionToday = false,
}: DashboardHeaderProps) {
  const userName = useMemo(() => {
    const raw = safeJsonParse(localStorage.getItem('user_profile'));
    return parseUserProfile(raw).name ?? null;
  }, []);

  const todayFull = useMemo(
    () =>
      new Date().toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    []
  );

  const currentGreeting = useMemo(() => greeting(), []);
  const reduced = useReducedMotion();

  return (
    <header
      className="flex items-start justify-between"
      style={{
        paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        paddingLeft: 'max(20px, env(safe-area-inset-left, 20px))',
        paddingRight: 'max(20px, env(safe-area-inset-right, 20px))',
        paddingBottom: 16,
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--fs-bg)',
      }}
      aria-label="כותרת לוח הבקרה"
    >
      {/* Gradient underline — replaces the flat 2px accent border with a
          mint→teal sweep + soft accent shadow. Horizontal gradient reads
          identically in RTL/LTR. Gentle scaleX fade-in from the start edge;
          snaps in under reduced-motion. */}
      <m.span
        aria-hidden="true"
        initial={reduced ? false : { opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          insetInlineEnd: 0,
          bottom: 0,
          height: 2,
          // Symmetric wipe origin so the entrance is identical in RTL and LTR
          // (logical transform-origin keywords aren't valid CSS).
          transformOrigin: 'center',
          background: 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))',
          boxShadow: '0 1px 6px color-mix(in srgb, var(--fs-accent) 40%, transparent)',
        }}
      />
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--fs-muted)',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {todayFull}
          {hasSessionToday && (
            <>
              {' · '}
              <span
                style={{
                  color: 'var(--fs-accent)',
                  fontWeight: 700,
                }}
              >
                ● פעיל היום
              </span>
            </>
          )}
        </p>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: 'var(--fs-ink)',
            margin: '4px 0 0',
          }}
        >
          {currentGreeting}
          {userName ? `, ${userName}` : ''}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--fs-muted)',
            margin: '6px 0 0',
          }}
        >
          {hasSessionToday ? 'יפה — אפשר להוסיף אימון נוסף אם בא לכם' : 'היום: התחילו אימון מהכפתור למטה'}
        </p>
      </div>
      <Link
        to="/settings"
        aria-label="הגדרות"
        className="flex-shrink-0 flex items-center justify-center w-10 h-10 mt-1 transition-colors hover:opacity-80 active:scale-95"
        style={{
          background: 'var(--fs-surface)',
          borderRadius: '12px',
          border: '1px solid var(--fs-surface-2)',
        }}
      >
        <Settings size={18} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
      </Link>
    </header>
  );
});

export default DashboardHeader;
