import { Sparkles } from 'lucide-react';
import { MONO_STYLE, greeting } from '../../utils/dateUtils';

interface GreetingProps {
  onThemeChange: () => void;
  weekNumber: number;
}

export function Greeting({ onThemeChange, weekNumber }: GreetingProps) {
  const today = new Date().toLocaleDateString('he-IL', {
    weekday: 'short',
  });
  const todayFull = new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Use max() so safe-area-inset-top adds padding ONLY when needed (notched devices)
  // while keeping minimum 20px padding on all devices
  const topPadding = 'max(20px, env(safe-area-inset-top, 20px))';
  const leftPadding = 'max(16px, env(safe-area-inset-left, 16px))';
  const rightPadding = 'max(16px, env(safe-area-inset-right, 16px))';

  return (
    <header
      className="masthead"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        paddingTop: topPadding,
        paddingLeft: leftPadding,
        paddingRight: rightPadding,
      }}
    >
      <div style={{ paddingLeft: 48 }}>
        <div className="kicker" style={MONO_STYLE}>
          {today} · {todayFull} · שבוע {String(weekNumber).padStart(2, '0')}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(40px, 11vw, 64px)',
            lineHeight: 0.9,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: 'var(--bone)',
            marginTop: 8,
          }}
        >
          {greeting()}.
        </h1>
      </div>

      <button
        type="button"
        onClick={onThemeChange}
        aria-label="שנה ערכת נושא"
        className="focus-ring"
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top, 16px))',
          left: 'max(16px, env(safe-area-inset-left, 16px))',
          width: 44,
          height: 44,
          background: 'transparent',
          border: '1px solid rgba(245, 241, 235, 0.3)',
          borderRadius: 0,
          color: 'var(--bone)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Sparkles size={16} />
      </button>
    </header>
  );
}
