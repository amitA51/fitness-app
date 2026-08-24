import {
  CalendarDays,
  ClipboardList,
  Dumbbell,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
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
import { listMyCoaches } from '../../services/coach';
import type { CoachClient } from '../../types/coach';
import { triggerHapticEffect } from '../../utils/haptics';
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
// BottomNav — 5 fixed tabs + a "More" sheet, branched by role.
//
// Trainee tabs: בית /, אימון /workout, התקדמות /progress, תזונה /nutrition.
// Coach tabs:   בית /coach, מתאמנים /coach/clients, הודעות /coach/messages,
//               תוכניות /coach/programs (the coach IS the primary experience).
// The "עוד" sheet is grouped into labeled sections (האימון שלי / מאמן וקהילה /
// חשבון), each row carrying a mono subtitle. The coach view swaps in האימונים
// שלי (/me, the personal-training secondary mode); the trainee view adds המאמן
// שלי + (conditionally) הודעות.
// Unread badge: trainee on "עוד"; coach directly on the הודעות tab.
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
  /** One-line mono disambiguator shown under the label in the "עוד" sheet. */
  subtitle?: string;
}

/** A labeled group of destinations in the "עוד" sheet (kicker + its rows). */
interface NavGroup {
  kicker: string;
  items: NavDestination[];
}

/** Shared "עוד"-sheet subtitles — defined once, referenced in both role groupings. */
const PROGRAM_SUBTITLE = 'תוכנית מובנית · 12 שבועות';
const TEMPLATES_SUBTITLE = 'אימונים שיצרת לשימוש חוזר';
const COMMUNITY_SUBTITLE = 'שיתוף ומעקב עם מתאמנים';

const TRAINEE_MAIN_TABS: readonly NavDestination[] = [
  { path: '/', label: 'בית', icon: LayoutDashboard },
  { path: '/workout', label: 'אימון', icon: Dumbbell },
  { path: '/progress', label: 'התקדמות', icon: TrendingUp },
  { path: '/nutrition', label: 'תזונה', icon: UtensilsCrossed },
] as const;

const COACH_MAIN_TABS: readonly NavDestination[] = [
  { path: '/coach', label: 'בית', icon: LayoutDashboard },
  { path: '/coach/clients', label: 'מתאמנים', icon: Users },
  { path: '/coach/messages', label: 'הודעות', icon: MessageSquare },
  { path: '/coach/programs', label: 'תוכניות', icon: ClipboardList },
] as const;

const TRAINEE_MORE_PATHS: readonly string[] = [
  '/my-coach',
  '/program',
  '/templates',
  '/community',
  '/settings',
];
// While a coach is in personal-training mode (/me and the shared personal
// surfaces), the "עוד" tab reads as active — those screens live in its sheet.
const COACH_MORE_PATHS: readonly string[] = [
  '/me',
  '/workout',
  '/progress',
  '/nutrition',
  '/program',
  '/templates',
  '/detail',
  '/community',
  '/settings',
];

/** Whether `pathname` matches a nav destination (exact for "/", prefix otherwise). */
function matchesPath(pathname: string, path: string): boolean {
  return path === '/' ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}

// Hash anchor MyCoach scrolls to when a trainee with multiple coaches taps the
// "הודעות" entry — lands them on the coaches list so they can pick a thread.
const COACHES_LIST_HASH = '#coaches';

/**
 * Resolve the trainee's chat deep-link target from their active coaches:
 *   • exactly one  → straight into that 1-to-1 thread
 *   • two or more  → MyCoach scrolled to the coaches list (pick a coach there)
 *   • none / error → null, so the chat entry is omitted entirely (no coach to
 *                    message yet — "המאמן שלי" already covers the connect path)
 * Trainee-only, fetched once on mount; coach view never calls it.
 */
function useTraineeChatTarget(enabled: boolean): string | null {
  const [coaches, setCoaches] = useState<CoachClient[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    listMyCoaches('active')
      .then((list) => {
        if (active) setCoaches(list);
      })
      .catch(() => {
        /* offline / pre-migration — chat entry stays hidden below */
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  if (coaches.length === 1 && coaches[0]) return `/my-coach/messages/${coaches[0].coachId}`;
  if (coaches.length > 1) return `/my-coach${COACHES_LIST_HASH}`;
  return null;
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
        className="text-[10px] leading-none transition-colors inline-flex items-center gap-1"
        style={{
          fontFamily: 'var(--font-body)',
          color: isActive ? 'var(--nav-pill-text)' : 'var(--nav-label-inactive)',
          fontWeight: isActive ? 600 : 500,
          letterSpacing: '-0.01em',
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
  const { isCoachView } = useCoach();
  const unread = useUnreadMessages();
  const [moreOpen, setMoreOpen] = useState(false);
  const reduced = useReducedMotion();

  const ulRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const firstRunRef = useRef(true);
  const prevUnreadRef = useRef(unread);

  const mainTabs = isCoachView ? COACH_MAIN_TABS : TRAINEE_MAIN_TABS;
  const morePaths = isCoachView ? COACH_MORE_PATHS : TRAINEE_MORE_PATHS;

  // Trainee chat deep-link target (resolved from active coaches). Coaches reach
  // chat via the dedicated הודעות tab, so this only fetches in the trainee view.
  const traineeChatTarget = useTraineeChatTarget(!isCoachView);

  // One very-light tick on tab selection — routed through the canonical
  // selection effect so the Settings haptics toggle gates it; reduced-motion
  // skips this non-essential micro-interaction.
  const tapHaptic = useCallback(() => {
    if (!reduced) triggerHapticEffect('selection');
  }, [reduced]);

  const isMoreActive = useMemo(
    () => morePaths.some((p) => matchesPath(location.pathname, p)),
    [location.pathname, morePaths]
  );

  // Longest match wins so nested coach paths light the right tab
  // (/coach/clients/:id → מתאמנים, not בית which is a prefix of everything).
  const activeMainPath = useMemo(() => {
    const matches = mainTabs.filter(({ path }) => matchesPath(location.pathname, path));
    if (matches.length === 0) return undefined;
    return matches.reduce((best, t) => (t.path.length > best.path.length ? t : best)).path;
  }, [location.pathname, mainTabs]);

  const activeKey = useMemo(() => {
    if (activeMainPath) return activeMainPath;
    return isMoreActive ? 'more' : undefined;
  }, [activeMainPath, isMoreActive]);

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

  // The "עוד" sheet, grouped into labeled sections so the eye can triage
  // "my training" vs "coach & community" vs "account" instead of scanning one
  // flat list of six unrelated destinations. Each planning row carries a
  // one-line mono subtitle that disambiguates the otherwise look-alike surfaces
  // (the built-in structured program vs the user's own reusable templates).
  const moreGroups = useMemo<NavGroup[]>(
    () =>
      isCoachView
        ? [
            {
              kicker: 'האימון שלי',
              items: [
                {
                  path: '/me',
                  label: 'האימונים שלי',
                  icon: Dumbbell,
                  subtitle: 'האימון האישי שלך',
                },
                {
                  path: '/program',
                  label: 'תוכנית האימון',
                  icon: CalendarDays,
                  subtitle: PROGRAM_SUBTITLE,
                },
                {
                  path: '/templates',
                  label: 'תבניות',
                  icon: ClipboardList,
                  subtitle: TEMPLATES_SUBTITLE,
                },
              ],
            },
            {
              kicker: 'קהילה',
              items: [
                {
                  path: '/community',
                  label: 'קהילה',
                  icon: Users,
                  subtitle: COMMUNITY_SUBTITLE,
                },
              ],
            },
            { kicker: 'חשבון', items: [{ path: '/settings', label: 'הגדרות', icon: Settings }] },
          ]
        : [
            {
              kicker: 'האימון שלי',
              items: [
                {
                  path: '/program',
                  label: 'תוכנית האימון',
                  icon: CalendarDays,
                  subtitle: PROGRAM_SUBTITLE,
                },
                {
                  path: '/templates',
                  label: 'תבניות',
                  icon: ClipboardList,
                  subtitle: TEMPLATES_SUBTITLE,
                },
              ],
            },
            {
              kicker: 'מאמן וקהילה',
              items: [
                {
                  path: '/my-coach',
                  label: 'המאמן שלי',
                  icon: UserCog,
                  subtitle: 'חיבור, תוכניות ומעקב',
                },
                // Chat parity for trainees: deep-links into the (single) coach
                // thread or the coaches list when there are several; carries the
                // unread badge. Omitted when there's no coach to message yet.
                ...(traineeChatTarget
                  ? [
                      {
                        path: traineeChatTarget,
                        label: 'הודעות',
                        icon: MessageSquare,
                        subtitle: 'שיחה עם המאמן',
                      },
                    ]
                  : []),
                {
                  path: '/community',
                  label: 'קהילה',
                  icon: Users,
                  subtitle: COMMUNITY_SUBTITLE,
                },
              ],
            },
            { kicker: 'חשבון', items: [{ path: '/settings', label: 'הגדרות', icon: Settings }] },
          ],
    [isCoachView, traineeChatTarget]
  );

  const handleMoreNavigate = (path: string) => {
    tapHaptic();
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
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderTop: '1px solid var(--nav-border)',
          boxShadow: 'var(--nav-shadow)',
        }}
      >
        <ul
          ref={ulRef}
          onPointerDown={ensureGsap}
          onPointerEnter={ensureGsap}
          className="relative flex justify-around items-center min-h-16 max-w-md mx-auto px-1"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
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
              // Only hint the compositable property. width/height are layout —
              // will-change can't composite them, so listing them just keeps an
              // extra promoted layer alive permanently for no gain.
              willChange: 'transform',
            }}
          />

          {mainTabs.map(({ path, label, icon }) => {
            const isActive = path === activeMainPath;
            const tabBadge = isCoachView && path === '/coach/messages' ? unread : 0;
            return (
              <li key={path} className="flex-1 h-full">
                <Link
                  to={path}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={tabBadge > 0 ? `${label} (${tabBadge} הודעות שלא נקראו)` : label}
                  onTouchStart={() => prefetchRoute(path)}
                  onMouseEnter={() => prefetchRoute(path)}
                  onClick={(e) => {
                    tapHaptic();
                    if (!isActive) return;
                    e.preventDefault();
                    scrollToTop();
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    tapHaptic();
                    const linkEl = e.currentTarget as HTMLAnchorElement;
                    if (!isActive) linkEl.click();
                    else scrollToTop();
                  }}
                  className={TAB_CLASS}
                >
                  <TabVisual icon={icon} label={label} isActive={isActive} badgeCount={tabBadge} />
                </Link>
              </li>
            );
          })}

          {/* "עוד" — opens the role sheet; for trainees it carries the unread
              badge (coaches see it on the הודעות tab instead). */}
          <li className="flex-1 h-full">
            <button
              type="button"
              onClick={() => {
                tapHaptic();
                setMoreOpen(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-current={isMoreActive ? 'page' : undefined}
              aria-label={!isCoachView && unread > 0 ? `עוד (${unread} הודעות שלא נקראו)` : 'עוד'}
              className={TAB_CLASS}
            >
              <TabVisual
                icon={!isCoachView && unread > 0 ? MessageSquare : MoreHorizontal}
                label="עוד"
                isActive={isMoreActive}
                badgeCount={isCoachView ? 0 : unread}
              />
            </button>
          </li>
        </ul>
      </nav>

      <Sheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="עוד">
        <div className="flex flex-col gap-5">
          {moreGroups.map((group) => (
            <div key={group.kicker} className="flex flex-col gap-2">
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: 'var(--fs-muted)',
                  paddingInlineStart: 4,
                }}
              >
                {group.kicker}
              </span>
              <ul className="flex flex-col gap-2">
                {group.items.map(({ path, label, icon: Icon, subtitle }) => {
                  const isActive = matchesPath(location.pathname, path);
                  // The unread badge rides the dedicated הודעות entry (its
                  // deep-link path varies, so key off the label, not a fixed path).
                  const showBadge = label === 'הודעות' && unread > 0;
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
                        className="flex items-center gap-3 w-full min-h-[52px] px-4 py-2 transition-colors transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2"
                        style={{
                          background: isActive
                            ? 'var(--fs-overlay-active)'
                            : 'var(--fs-overlay-hover)',
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
                          className="min-w-0"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            textAlign: 'start',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-body-lg)',
                              fontWeight: 600,
                              lineHeight: 1.2,
                            }}
                          >
                            {label}
                          </span>
                          {subtitle && (
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                color: 'var(--fs-muted)',
                                lineHeight: 1.3,
                              }}
                            >
                              {subtitle}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
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
