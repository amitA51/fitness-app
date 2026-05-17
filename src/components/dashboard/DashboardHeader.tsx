import { memo, useEffect, useState } from 'react';
import { greeting } from '../../utils/dateUtils';

interface DashboardHeaderProps {
  weekNumber: number;
}

export const DashboardHeader = memo(function DashboardHeader({ weekNumber }: DashboardHeaderProps) {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  // Live clock — updates every second
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Get user name from localStorage
  const userName = (() => {
    try {
      const profile = localStorage.getItem('user_profile');
      if (profile) {
        const parsed = JSON.parse(profile);
        return parsed.name || parsed.displayName || null;
      }
    } catch {
      // ignore
    }
    return null;
  })();

  // Hebrew date
  const todayFull = new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Time-based greeting
  const currentGreeting = greeting();

  // Week label
  const weekLabel = `שבוע ${String(weekNumber).padStart(2, '0')}`;

  // Safe area padding
  const topPadding = 'max(16px, env(safe-area-inset-top, 16px))';
  const sidePadding =
    'max(20px, env(safe-area-inset-left, 20px)) max(20px, env(safe-area-inset-right, 20px))';

  return (
    <header
      style={{
        background: 'var(--fs-primary)',
        paddingTop: topPadding,
        paddingLeft: sidePadding,
        paddingRight: sidePadding,
        paddingBottom: 16,
        position: 'sticky',
        top: 0,
        zIndex: 20,
        overflow: 'hidden',
      }}
      aria-label="כותרת לוח הבקרה"
    >
      <div className="fs-grid-texture" aria-hidden />
      {/* Top row: Greeting + Clock */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          position: 'relative',
        }}
      >
        <div className="fs-brand-icon" aria-hidden />
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 'clamp(28px, 8vw, 44px)',
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              color: 'var(--fs-bg)',
              margin: 0,
            }}
          >
            {currentGreeting}
            {userName ? `, ${userName}` : ''}!
          </h1>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--fs-steel)',
              marginTop: 6,
            }}
          >
            {todayFull} · {weekLabel}
          </div>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            fontSize: 22,
            color: 'var(--fs-accent)',
            letterSpacing: '0.05em',
          }}
          aria-label={`שעון: ${time}`}
          role="timer"
        >
          {time}
        </div>
      </div>
    </header>
  );
});

export default DashboardHeader;
