import { motion } from 'framer-motion';
import { Dumbbell, History, LayoutDashboard, Settings, UtensilsCrossed } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'דשבורד', icon: LayoutDashboard },
  { path: '/workout', label: 'אימון', icon: Dumbbell },
  { path: '/nutrition', label: 'תזונה', icon: UtensilsCrossed },
  { path: '/history', label: 'היסטוריה', icon: History },
  { path: '/settings', label: 'הגדרות', icon: Settings },
] as const;

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed bottom-0 inset-x-0 z-nav bg-navy safe-area-bottom"
      style={{ borderTop: '1px solid var(--navy-deep)' }}
    >
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === '/'
              ? location.pathname === path
              : location.pathname === path || location.pathname.startsWith(`${path}/`);

          return (
            <Link
              key={path}
              to={path}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
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
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[48px] transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="navBg"
                  className="absolute inset-x-2 bottom-1 h-1"
                  style={{ backgroundColor: 'var(--mustard)' }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}

              <Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.8}
                className="relative z-10 transition-colors"
                style={{
                  color: isActive ? 'var(--mustard)' : 'rgba(245, 241, 235, 0.4)',
                }}
              />

              <span
                className="relative z-10 font-mono text-[10px] font-semibold leading-none uppercase transition-colors"
                style={{
                  color: isActive ? 'var(--mustard)' : 'rgba(245, 241, 235, 0.4)',
                  letterSpacing: '0.08em',
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
