import {
  Dumbbell,
  LayoutDashboard,
  type LucideIcon,
  MoreHorizontal,
  Settings,
  TrendingUp,
  UserCog,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCoach } from '../../contexts/CoachContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { prefetchRoute } from '../../utils/routePrefetch';
import { Sheet } from './Sheet';

// Lazy GSAP handle — loaded on first interaction so the ~28KB gsap chunk stays
// out of the critical initial bundle (BottomNav is always mounted). Until it
// resolves, the pill snaps instantly via direct DOM styles (no animation).
type GsapModule = typeof import('../../lib/gsap');
let gsapModulePromise: Promise<GsapModule> | null = null;
function loadGsap(): Promise<GsapModule> {
  if (!gsapModulePromise) gsapModulePromise = import('../../lib/gsap');
  return gsapModulePromise;
}

// Local copies of the few motion tokens this component animates with. Inlined
// (not imported from lib/gsap) so reading them never eagerly pulls the gsap
// chunk into the initial bundle — they're just primitive values.
const DUR = { micro: 0.16, fast: 0.3, base: 0.6 } as const;
const EASE = { popHard: 'back.out(3)', slide: 'power3.inOut' } as const;

// ============================================================================
// BottomNav — 5 fixed tabs + a "More" sheet.
//
// Tabs: בית /, אימון /workout, התקדמות /progress, תזונה /nutrition, עוד (sheet).
// The "עוד" sheet holds the coach surfaces: "המאמן שלי" /my-coach (everyone),
// "הגדרות" /settings (everyone) and, only for coaches, "ניהול מתאמנים" /coach.
// Coach destinations no longer live in the bar itself — keeping it a stable
// 5-up grid regardless of role.
// The unread coach-message badge moves to the "עוד" tab.
//
// Motion (GSAP): a single shared underlay pill flows between tab slots as the
// route changes (measured physical rects → RTL-correct with no sign flipping).
// The active icon gets a back.out overshoot on landing, and the unread badge
// pops only when the count increases. All guarded for reduced motion.
// ============================================================================

interface NavDestination {
  path: string;
  label: string;
  icon: LucideIcon;
}

const MAIN_TABS: readonly NavDestination[] = [
  { path: '/', label: 'בית', icon: LayoutDashboard },
  { path: '/workout', label: 'אימון', icon: Dumbbell },
  { path: '/progress', label: 'התקדמות', icon: TrendingUp },
  { path: '/nutrition', label: 'תזונה', icon: UtensilsCrossed },
] as const;

const MORE_PATHS = ['/my-coach', '/coach', '/settings'] as const;

/** Whether `pathname` matches a nav destination (exact for "/", prefix otherwise). */
function matchesPath(pathname: string, path: string): boolean {
  return path === '/' ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

// ── Shared inner visual — always-on icon/label cluster ───────────────────────
// The active background is supplied by the single shared pill underlay (in the
// parent), so this cluster keeps the SAME padding whether active or not. That
// keeps layout stable as the pill flows, and lets icon/label color crossfade.

interface TabVisualProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  badgeCount?: number;
}

const TabVisual = memo(function TabVisual({
  icon: Icon,
  label,
  isActive,
  badgeCount = 0,
}: TabVisualProps) {
  return (
    <span
      data-nav-slot
      data-active={isActive ? 'true' : undefined}
      className="relative z-10 inline-flex flex-col items-center justify-center gap-0.5"
      style={{ padding: '6px 14px', borderRadius: 999 }}
    >
      <span className="relative inline-flex">
        <Icon
          data-nav-icon
          size={20}
          strokeWidth={isActive ? 2.2 : 1.6}
          className="transition-colors"
          style={{ color: isActive ? 'var(--nav-pill-text)' : 'var(--nav-icon-inactive)' }}
          aria-hidden="true"
        />
        {badgeCount > 0 && <Badge count={badgeCount} />}
      </span>
      <span
        className="font-mono text-[10px] leading-none uppercase transition-colors inline-flex items-center gap-1"
        style={{
          color: isActive ? 'var(--nav-pill-text)' : 'var(--nav-label-inactive)',
          fontWeight: isActive ? 600 : 500,
          letterSpacing: '0.08em',
        }}
      >
        {isActive && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--nav-pill-text)',
            }}
          />
        )}
        {label}
      </span>
    </span>
  );
});

/** Unread-count pill, anchored to the top inline-end corner of its relative parent. */
const Badge = memo(function Badge({ count }: { count: number }) {
  return (
    <span
      className="js-nav-badge"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: -6,
        insetInlineEnd: -10,
        zIndex: 20,
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        borderRadius: 999,
        background: 'var(--fs-accent)',
        color: 'var(--color-ink-on-accent)',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        fontWeight: 700,
        lineHeight: '16px',
        textAlign: 'center',
      }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
});

const TAB_CLASS =
  'relative flex flex-col items-center justify-center gap-0.5 w-full h-full min-h-[48px] transition-colors transition-transform duration-75 active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fs-primary)] rounded-sm';

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCoach } = useCoach();
  const unread = useUnreadMessages();
  const [moreOpen, setMoreOpen] = useState(false);
  const reduced = useReducedMotion();

  const ulRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const firstRunRef = useRef(true);
  const prevUnreadRef = useRef(unread);

  const isMoreActive = useMemo(
    () => MORE_PATHS.some((p) => matchesPath(location.pathname, p)),
    [location.pathname]
  );

  const activeKey = useMemo(() => {
    const main = MAIN_TABS.find(({ path }) => matchesPath(location.pathname, path));
    if (main) return main.path;
    return isMoreActive ? 'more' : undefined;
  }, [location.pathname, isMoreActive]);

  // Whether GSAP has loaded yet. Before it does, pill moves snap instantly via
  // direct DOM styles (no animation); after, transitions flow smoothly.
  const gsapRef = useRef<GsapModule | null>(null);

  // Snap the pill to the active slot with plain DOM styles — no library needed.
  // Measuring physical getBoundingClientRect is RTL-correct for free: the browser
  // already laid the tabs out right→left, so the pill lands in the right place
  // with no sign flipping. Returns the measured box (or null if no active slot).
  const snapPillToActive = useCallback(() => {
    const ul = ulRef.current;
    const pill = pillRef.current;
    if (!ul || !pill) return null;
    const slot = ul.querySelector<HTMLElement>('[data-nav-slot][data-active="true"]');
    if (!slot) {
      pill.style.opacity = '0';
      return null;
    }
    const u = ul.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    const box = { x: b.left - u.left, y: b.top - u.top, width: b.width, height: b.height };
    pill.style.transform = `translate(${box.x}px, ${box.y}px)`;
    pill.style.width = `${box.width}px`;
    pill.style.height = `${box.height}px`;
    pill.style.opacity = '1';
    pill.style.visibility = 'visible';
    return box;
  }, []);

  // Flow the shared pill to the active slot. First paint and reduced-motion snap
  // instantly; once GSAP has loaded (first interaction), subsequent route changes
  // animate the flow + a small icon pop.
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeKey is the route-change trigger; the body reads the active slot from the DOM, so it must re-run when activeKey changes.
  useLayoutEffect(() => {
    const g = gsapRef.current;
    const pill = pillRef.current;
    const ul = ulRef.current;

    if (reduced || firstRunRef.current || !g || !pill || !ul) {
      snapPillToActive();
      firstRunRef.current = false;
      return;
    }

    const slot = ul.querySelector<HTMLElement>('[data-nav-slot][data-active="true"]');
    if (!slot) {
      g.gsap.to(pill, { autoAlpha: 0, duration: DUR.micro });
      return;
    }
    const u = ul.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    const box = { x: b.left - u.left, y: b.top - u.top, width: b.width, height: b.height };
    g.gsap.to(pill, { ...box, autoAlpha: 1, duration: DUR.fast, ease: EASE.slide });
    const icon = slot.querySelector<SVGElement>('[data-nav-icon]');
    if (icon) {
      g.gsap.fromTo(
        icon,
        { scale: 1 },
        { scale: 1.12, duration: DUR.micro, ease: EASE.popHard, yoyo: true, repeat: 1 }
      );
    }
  }, [activeKey, reduced, snapPillToActive]);

  // Re-measure when the viewport resizes or webfonts load (Hebrew mono labels
  // shift width on font swap, which would desync the pill). Snap-only — no anim.
  useEffect(() => {
    const remeasure = () => snapPillToActive();
    window.addEventListener('resize', remeasure);
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(remeasure).catch(() => {});
    }
    return () => window.removeEventListener('resize', remeasure);
  }, [snapPillToActive]);

  // Badge pop only when the unread count INCREASES (not on every render). Needs
  // GSAP; before it loads, the badge simply appears (no pop).
  useEffect(() => {
    const increased = unread > prevUnreadRef.current;
    prevUnreadRef.current = unread;
    const g = gsapRef.current;
    if (reduced || !increased || !g) return;
    const badge = ulRef.current?.querySelector<HTMLElement>('.js-nav-badge');
    if (badge) {
      g.gsap.fromTo(
        badge,
        { scale: 0.6 },
        { scale: 1, duration: DUR.base, ease: 'back.out(2.5)', clearProps: 'scale' }
      );
    }
  }, [unread, reduced]);

  // Lazy-load GSAP on the first interaction anywhere in the nav, so the ~28KB
  // gsap chunk never blocks initial paint. Reduced-motion users skip it entirely.
  const ensureGsap = useCallback(() => {
    if (reduced || gsapRef.current) return;
    loadGsap()
      .then((mod) => {
        gsapRef.current = mod;
      })
      .catch(() => {
        /* animation is purely cosmetic — snap fallback stays in effect */
      });
  }, [reduced]);

  const moreItems = useMemo<NavDestination[]>(
    () => [
      { path: '/my-coach', label: 'המאמן שלי', icon: UserCog },
      ...(isCoach ? [{ path: '/coach', label: 'ניהול מתאמנים', icon: Users }] : []),
      { path: '/settings', label: 'הגדרות', icon: Settings },
    ],
    [isCoach]
  );

  const handleMoreNavigate = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  return (
    <>
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
          ref={ulRef}
          onPointerDown={ensureGsap}
          onPointerEnter={ensureGsap}
          className="relative flex justify-around items-center h-16 max-w-md mx-auto px-1"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Shared flowing pill underlay — positioned instantly via DOM styles on
              first paint; GSAP (lazy-loaded on first interaction) animates the flow. */}
          <div
            ref={pillRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              zIndex: 0,
              borderRadius: 999,
              background: 'var(--nav-pill-bg)',
              boxShadow: 'var(--nav-pill-shadow)',
              opacity: 0,
              pointerEvents: 'none',
              willChange: 'transform, width, height',
            }}
          />

          {MAIN_TABS.map(({ path, label, icon }) => {
            const isActive = matchesPath(location.pathname, path);
            return (
              <li key={path} className="flex-1 h-full">
                <Link
                  to={path}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={label}
                  onTouchStart={() => prefetchRoute(path)}
                  onMouseEnter={() => prefetchRoute(path)}
                  onClick={(e) => {
                    if (!isActive) return;
                    e.preventDefault();
                    scrollToTop();
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    const linkEl = e.currentTarget as HTMLAnchorElement;
                    if (!isActive) linkEl.click();
                    else scrollToTop();
                  }}
                  className={TAB_CLASS}
                >
                  <TabVisual icon={icon} label={label} isActive={isActive} />
                </Link>
              </li>
            );
          })}

          {/* "עוד" — opens the coach sheet; carries the unread badge. */}
          <li className="flex-1 h-full">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-current={isMoreActive ? 'page' : undefined}
              aria-label={unread > 0 ? `עוד (${unread} הודעות שלא נקראו)` : 'עוד'}
              className={TAB_CLASS}
            >
              <TabVisual
                icon={MoreHorizontal}
                label="עוד"
                isActive={isMoreActive}
                badgeCount={unread}
              />
            </button>
          </li>
        </ul>
      </nav>

      <Sheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="עוד">
        <ul className="flex flex-col gap-2">
          {moreItems.map(({ path, label, icon: Icon }) => {
            const isActive = matchesPath(location.pathname, path);
            const showBadge = path === '/my-coach' && unread > 0;
            return (
              <li key={path}>
                <Link
                  to={path}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={showBadge ? `${label} (${unread} הודעות שלא נקראו)` : label}
                  onTouchStart={() => prefetchRoute(path)}
                  onMouseEnter={() => prefetchRoute(path)}
                  onClick={(e) => {
                    e.preventDefault();
                    handleMoreNavigate(path);
                  }}
                  className="flex items-center gap-3 w-full min-h-[52px] px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2"
                  style={{
                    background: isActive ? 'var(--fs-overlay-active)' : 'var(--fs-overlay-hover)',
                    border: '1px solid var(--fs-surface-2)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--fs-ink)',
                  }}
                >
                  <span className="relative inline-flex shrink-0">
                    <Icon
                      size={22}
                      strokeWidth={1.8}
                      aria-hidden="true"
                      style={{ color: isActive ? 'var(--fs-accent)' : 'var(--fs-muted)' }}
                    />
                    {showBadge && <Badge count={unread} />}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-body-lg)',
                      fontWeight: 600,
                      textAlign: 'start',
                    }}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}

function scrollToTop(): void {
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  (document.getElementById('main-content') as HTMLElement | null)?.focus({
    preventScroll: true,
  });
}

export default memo(BottomNav);
