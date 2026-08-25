import { m } from 'framer-motion';
import { Settings, Zap } from 'lucide-react';
import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { greeting } from '../../utils/dateUtils';
import { safeJsonParse } from '../../utils/safeJson';
import { parseUserProfile } from '../../utils/validation';
import { levelFromXp } from '../../utils/workoutLevels';
import { getTotalXp } from '../../utils/xpStore';

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

  // Ambient XP presence: null until the lifter has earned their first XP
  // (fresh installs show no dead chrome), otherwise the current ladder level.
  const levelInfo = useMemo(() => {
    const xpTotal = getTotalXp();
    if (xpTotal <= 0) return null;
    return levelFromXp(xpTotal);
  }, []);
  const level = levelInfo?.level ?? null;
  const intoNext = levelInfo ? levelInfo.levelSpan - levelInfo.intoLevel : 0;

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
        background: 'color-mix(in srgb, var(--fs-bg) 78%, transparent)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      }}
      aria-label="כותרת לוח הבקרה"
    >
      {/* Hairline bottom edge — Apple nav separator */}
      <m.span
        aria-hidden="true"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          insetInlineEnd: 0,
          bottom: 0,
          height: '0.5px',
          background: 'var(--color-separator)',
        }}
      />
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--fs-muted)',
            margin: 0,
            lineHeight: 1.35,
            letterSpacing: '-0.01em',
          }}
        >
          {todayFull}
          {hasSessionToday && (
            <>
              {' · '}
              <span
                style={{
                  color: 'var(--fs-accent)',
                  fontWeight: 600,
                }}
              >
                פעיל היום
              </span>
            </>
          )}
        </p>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 28,
            lineHeight: 1.12,
            letterSpacing: '-0.022em',
            color: 'var(--fs-ink)',
            margin: '4px 0 0',
          }}
        >
          {currentGreeting}
          {userName ? `, ${userName}` : ''}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            letterSpacing: '-0.01em',
            /* #8c8c8c muted was too dim on black for this micro-instruction;
               ink at reduced weight keeps it legible without shouting. */
            color: 'var(--fs-ink-muted)',
            fontWeight: 500,
            opacity: 0.92,
            margin: '6px 0 0',
          }}
        >
          {hasSessionToday
            ? 'יפה — אפשר להוסיף אימון נוסף אם בא לכם'
            : 'היום: התחילו אימון מהכפתור למטה'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 mt-1">
        {/* Level chip — quiet ambient presence for the XP ladder (hidden until
            the first session awards XP). Links to Progress, where the full
            level card lives. */}
        {level !== null && (
          <Link
            to="/progress"
            aria-label={`רמה ${level} · עוד ${intoNext} XP לרמה ${level + 1}`}
            className="flex items-center justify-center w-10 h-10 transition-colors hover:opacity-80 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] rounded-full"
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                width: 40,
                height: 40,
                borderRadius: 9999,
                background: 'var(--fs-surface-2)',
              }}
            >
              <Zap size={13} strokeWidth={2.5} style={{ color: 'var(--fs-accent)' }} />
              <span
                dir="ltr"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--fs-ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {level}
              </span>
            </span>
          </Link>
        )}
        <Link
          to="/settings"
          aria-label="הגדרות"
          className="flex-shrink-0 flex items-center justify-center w-10 h-10 transition-colors hover:opacity-80 active:scale-95"
          style={{
            background: 'var(--fs-surface-2)',
            borderRadius: 9999,
            border: 'none',
          }}
        >
          <Settings size={18} style={{ color: 'var(--fs-ink)' }} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
});

export default DashboardHeader;
