import { Dumbbell, LayoutDashboard, Settings, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { prefetchRoute } from '../../utils/routePrefetch';

const NAV_ITEMS = [
  { path: '/', label: 'בית', icon: LayoutDashboard },
  { path: '/workout', label: 'אימון', icon: Dumbbell },
  { path: '/progress', label: 'התקדמות', icon: TrendingUp },
  { path: '/nutrition', label: 'תזונה', icon: UtensilsCrossed },
  { path: '/settings', label: 'הגדרות', icon: Settings },
] as const;

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed bottom-0 inset-x-0 z-nav safe-area-bottom"
      style={{
        backgroundColor: 'var(--fs-primary)',
        borderTop: '1px solid var(--fs-primary)',
        contain: 'layout style paint',
      }}
    >
      <ul className="flex justify-around items-center h-16 max-w-md mx-auto px-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === '/'
              ? location.pathname === path
              : location.pathname === path || location.pathname.startsWith(`${path}/`);

          return (
            <li key={path}>
              <Link
                to={path}
                aria-current={isActive ? 'page' : undefined}
                aria-label={label}
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
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[48px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fs-primary)] rounded-sm"
              >
                <span
                  className="relative z-10 inline-flex flex-col items-center justify-center gap-0.5"
                  style={
                    isActive
                      ? {
                          borderRadius: 999,
                          background: 'var(--fs-primary)',
                          color: '#fff',
                          padding: '6px 12px',
                        }
                      : undefined
                  }
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className="transition-colors"
                    style={{
                      color: isActive ? '#fff' : 'rgba(var(--text-on-navy-rgb), 0.65)',
                    }}
                    aria-hidden="true"
                  />

                  <span
                    className="font-mono text-[10px] font-semibold leading-none uppercase transition-colors"
                    style={{
                      color: isActive ? '#fff' : 'rgba(var(--text-on-navy-rgb), 0.65)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {label}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
