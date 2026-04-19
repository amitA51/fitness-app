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

  return (
    <header className="masthead safe-area-top" style={{ position: 'relative' }}>
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
          top: 16,
          left: 16,
          width: 36,
          height: 36,
          background: 'transparent',
          border: '1px solid var(--bone)',
          color: 'var(--bone)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Sparkles size={14} />
      </button>
    </header>
  );
}
