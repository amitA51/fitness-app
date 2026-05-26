import { Settings } from 'lucide-react';
import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { greeting } from '../../utils/dateUtils';
import { safeJsonParse } from '../../utils/safeJson';

interface DashboardHeaderProps {
  hasSessionToday?: boolean;
}

export const DashboardHeader = memo(function DashboardHeader({
  hasSessionToday = false,
}: DashboardHeaderProps) {
  const userName = useMemo(() => {
    try {
      const profile = localStorage.getItem('user_profile');
      const parsed = safeJsonParse<{ name?: string; displayName?: string }>(profile);
      if (parsed) return parsed.name || parsed.displayName || null;
    } catch {
      /* ignore */
    }
    return null;
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
        borderBottom: '2px solid var(--fs-accent)',
      }}
      aria-label="כותרת לוח הבקרה"
    >
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
