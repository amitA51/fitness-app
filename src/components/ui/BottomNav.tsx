import React from 'react';
import { LayoutDashboard, Dumbbell, UtensilsCrossed, History, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

// ============================================================================
// Navigation Items
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  { path: '/',          label: 'דשבורד',   icon: LayoutDashboard },
  { path: '/workout',   label: 'אימון',    icon: Dumbbell        },
  { path: '/nutrition', label: 'תזונה',    icon: UtensilsCrossed },
  { path: '/history',   label: 'היסטוריה',  icon: History        },
  { path: '/settings',  label: 'הגדרות',   icon: Settings        },
];

// ============================================================================
// BottomNav — Premium Design with Spring Physics
// ============================================================================

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="
        fixed bottom-0 inset-x-0 z-50
        backdrop-blur-2xl bg-black/90
        border-t border-white/[0.04]
        safe-area-bottom
      "
    >
      {/* Premium Glass Effect Border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Tab Row */}
      <div className="flex justify-around items-center h-[64px] max-w-md mx-auto px-2">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;

          return (
            <Link
              key={path}
              to={path}
              className={`
                relative flex flex-col items-center justify-center
                gap-1 flex-1 h-full min-h-[52px] py-1.5
                transition-colors duration-200
                group select-none
              `}
            >
              {/* Icon Container */}
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.1 : 1,
                  y: isActive ? -2 : 0,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 20,
                }}
                className={`
                  relative flex items-center justify-center
                  transition-colors duration-200
                `}
              >
                {/* Glow Effect for Active */}
                {isActive && (
                  <motion.div
                    layoutId="navGlow"
                    className="absolute inset-0 bg-primary/20 rounded-xl blur-md"
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 25,
                    }}
                  />
                )}

                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={`
                    relative z-10 transition-colors duration-200
                    ${isActive
                      ? 'text-primary'
                      : 'text-label-tertiary group-hover:text-label-secondary'
                    }
                  `}
                />
              </motion.div>

              {/* Label */}
              <span
                className={`
                  text-[10px] font-semibold leading-none tracking-wide
                  transition-all duration-200
                  ${isActive
                    ? 'text-primary'
                    : 'text-label-tertiary group-hover:text-label-secondary'
                  }
                `}
              >
                {label}
              </span>

              {/* Active Indicator Dot */}
              {isActive && (
                <motion.span
                  layoutId="activeDot"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2"
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  <span className="block w-1 h-1 rounded-full bg-primary animate-pulse" />
                </motion.span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
