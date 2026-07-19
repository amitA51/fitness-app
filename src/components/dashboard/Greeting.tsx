import { MONO_STYLE, greeting } from '../../utils/dateUtils';

interface GreetingProps {
  weekNumber: number;
}

export function Greeting({ weekNumber }: GreetingProps) {
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
      className="masthead fade-rise-in"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        paddingTop: topPadding,
        paddingLeft: leftPadding,
        paddingRight: rightPadding,
      }}
    >
      <div>
        <div className="kicker" style={MONO_STYLE}>
          {today} · {todayFull} · שבוע{' '}
          <span className="kinetic-number" dir="ltr">
            {String(weekNumber).padStart(2, '0')}
          </span>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(32px, 10vw, 64px)',
            lineHeight: 0.9,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink-on-dark)',
            marginTop: 8,
          }}
        >
          {greeting()}.
        </h1>
      </div>
    </header>
  );
}
