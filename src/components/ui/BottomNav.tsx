import { Dumbbell, LayoutDashboard, TrendingUp, UserCog, UtensilsCrossed } from 'lucide-react';
import { memo, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCoach } from '../../contexts/CoachContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { prefetchRoute } from '../../utils/routePrefetch';

const BASE_NAV_ITEMS = [
  { path: '/', label: 'בית', icon: LayoutDashboard },
  { path: '/workout', label: 'אימון', icon: Dumbbell },
  { path: '/progress', label: 'התקדמות', icon: TrendingUp },
  { path: '/nutrition', label: 'תזונה', icon: UtensilsCrossed },
] as const;

export default memo(function BottomNav() {
  const location = useLocation();
  const { isCoach } = useCoach();
  const unread = useUnreadMessages();

  // Context-aware coaching tab: coaches reach their hub; everyone else reaches
  // the trainee "My Coach" screen (connect to a coach, view assignments).
  const NAV_ITEMS = useMemo(
    () => [
      ...BASE_NAV_ITEMS,
      isCoach
        ? { path: '/coach', label: 'מאמן', icon: UserCog }
        : { path: '/my-coach', label: 'מאמן', icon: UserCog },
    ],
    [isCoach]
  );

  // Determine active path for keying the pill entrance animation
  const activePath = useMemo(
    () =>
      NAV_ITEMS.find(({ path }) =>
        path === '/'
          ? location.pathname === path
          : location.pathname === path || location.pathname.startsWith(`${path}/`)
      )?.path,
    [location.pathname, NAV_ITEMS]
  );

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed bottom-0 inset-x-0 z-nav safe-area-bottom"
      style={{
        contain: 'layout style paint',
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderTop: '1px solid var(--nav-border)',
        boxShadow: 'var(--nav-shadow)',
      }}
    >
      <ul
        className="flex justify-around items-center h-16 max-w-md mx-auto px-1"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === '/'
              ? location.pathname === path
              : location.pathname === path || location.pathname.startsWith(`${path}/`);

          const showBadge = (path === '/coach' || path === '/my-coach') && unread > 0;

          return (
            <li key={path} className="flex-1 h-full">
              <Link
                to={path}
                aria-current={isActive ? 'page' : undefined}
                aria-label={showBadge ? `${label} (${unread} הודעות שלא נקראו)` : label}
                onTouchStart={() => prefetchRoute(path)}
                onMouseEnter={() => prefetchRoute(path)}
                onClick={(e) => {
                  if (!isActive) return;
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  (document.getElementById('main-content') as HTMLElement | null)?.focus({
                    preventScroll: true,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const linkEl = e.currentTarget as HTMLAnchorElement;
                    if (!isActive) {
                      linkEl.click();
                    } else {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      (document.getElementById('main-content') as HTMLElement | null)?.focus({
                        preventScroll: true,
                      });
                    }
                  }
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[48px] transition-colors transition-transform duration-75 active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fs-primary)] rounded-sm ${
                  isActive ? '' : 'magnetic-card'
                }`}
              >
                {showBadge && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 4,
                      left: '50%',
                      transform: 'translateX(6px)',
                      zIndex: 20,
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      borderRadius: 999,
                      background: 'var(--fs-accent)',
                      color: 'var(--fs-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      lineHeight: '16px',
                      textAlign: 'center',
                    }}
                  >
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
                {isActive ? (
                  <span
                    key={activePath}
                    className="scale-pop-in relative z-10 inline-flex flex-col items-center justify-center gap-0.5"
                    style={{
                      borderRadius: 999,
                      background: 'var(--nav-pill-bg)',
                      color: 'var(--nav-pill-text)',
                      padding: '6px 14px',
                      boxShadow: 'var(--nav-pill-shadow)',
                      transition: 'background 0.2s ease, box-shadow 0.2s ease',
                    }}
                  >
                    <Icon
                      size={20}
                      strokeWidth={2.2}
                      className="transition-colors"
                      style={{ color: 'var(--nav-pill-text)' }}
                      aria-hidden="true"
                    />
                    <span
                      className="font-mono text-[10px] font-semibold leading-none uppercase transition-colors inline-flex items-center gap-1"
                      style={{ color: 'var(--nav-pill-text)', letterSpacing: '0.08em' }}
                    >
                      <span className="breathing-dot" aria-hidden="true" />
                      {label}
                    </span>
                  </span>
                ) : (
                  <span className="relative z-10 inline-flex flex-col items-center justify-center gap-0.5">
                    <Icon
                      size={20}
                      strokeWidth={1.6}
                      className="transition-colors"
                      style={{ color: 'var(--nav-icon-inactive)' }}
                      aria-hidden="true"
                    />
                    <span
                      className="font-mono text-[10px] font-medium leading-none uppercase transition-colors"
                      style={{
                        color: 'var(--nav-label-inactive)',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {label}
                    </span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});
