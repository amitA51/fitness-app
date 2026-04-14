import React from 'react';
import { LayoutDashboard, Dumbbell, Utensils, History, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

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
  { path: '/nutrition', label: 'תזונה',    icon: Utensils        },
  { path: '/history',   label: 'היסטוריה',  icon: History        },
  { path: '/settings',  label: 'הגדרות',   icon: Settings        },
];

// ============================================================================
// BottomNav
// ============================================================================

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="
        fixed bottom-0 inset-x-0 z-50
        backdrop-blur-xl bg-black/90
        border-t border-white/[0.06]
      "
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Tab row */}
      <div className="flex justify-around items-center h-[60px] max-w-lg mx-auto px-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;

          return (
            <Link
              key={path}
              to={path}
              className="
                relative flex flex-col items-center justify-center
                gap-1 flex-1 h-full min-h-[48px] py-2
                transition-all duration-200 ease-out
                group select-none
              "
            >
              {/* Icon */}
              <Icon
                size={24}
                strokeWidth={isActive ? 2.2 : 1.8}
                className={`
                  transition-all duration-200 ease-out
                  ${isActive
                    ? 'text-primary scale-110'
                    : 'text-[#48484A] group-hover:text-[#636366]'
                  }
                `}
              />

              {/* Label */}
              <span
                className={`
                  text-[10px] font-medium leading-none tracking-wide
                  transition-all duration-200 ease-out
                  ${isActive
                    ? 'text-primary'
                    : 'text-[#48484A] group-hover:text-[#636366]'
                  }
                `}
              >
                {label}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <span
                  className="
                    absolute top-[8px] left-1/2 -translate-x-1/2
                    w-1 h-1 rounded-full bg-primary
                    nav-dot-pop
                  "
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
