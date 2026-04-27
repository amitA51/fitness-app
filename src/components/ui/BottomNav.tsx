import { motion } from 'framer-motion';
import { Dumbbell, History, LayoutDashboard, Settings, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { prefetchRoute } from '../../utils/routePrefetch';

const NAV_ITEMS = [
  { path: '/', label: 'דשבורד', icon: LayoutDashboard },
  { path: '/workout', label: 'אימון', icon: Dumbbell },
  { path: '/progress', label: 'התקדמות', icon: TrendingUp },
  { path: '/history', label: 'היסטוריה', icon: History },
  { path: '/nutrition', label: 'תזונה', icon: UtensilsCrossed },
  { path: '/settings', label: 'הגדרות', icon: Settings },
] as const;

export default function BottomNav() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed bottom-0 inset-x-0 z-nav bg-navy safe-area-bottom"
      style={{ borderTop: '1px solid var(--navy-deep)', contain: 'layout style paint' }}
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
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[48px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mustard focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded-sm"
              >
                {isActive && !prefersReducedMotion && (
                  <motion.div
                    layoutId="navBg"
                    className="absolute inset-x-2 bottom-1 h-1 rounded-full"
                    style={{ backgroundColor: 'var(--mustard)' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                {isActive && prefersReducedMotion && (
                  <div
                    className="absolute inset-x-2 bottom-1 h-1 rounded-full"
                    style={{ backgroundColor: 'var(--mustard)' }}
                  />
                )}

                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className="relative z-10 transition-colors"
                  style={{
                    color: isActive ? 'var(--mustard)' : 'rgba(var(--text-on-navy-rgb), 0.65)',
                  }}
                  aria-hidden="true"
                />

                <span
                  className="relative z-10 font-mono text-[10px] font-semibold leading-none uppercase transition-colors"
                  style={{
                    color: isActive ? 'var(--mustard)' : 'rgba(var(--text-on-navy-rgb), 0.65)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
