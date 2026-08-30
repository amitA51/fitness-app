// ============================================================================
// PUBLIC PROFILE PAGE — פרופיל ציבורי · route /u/:userId
//
// Read-only public view of another user's profile: display name, avatar
// (initials fallback), bio, and earned achievement badges. Consumes the
// existing profile service (getPublicProfile + getUserAchievements +
// listAchievements) — never re-implements data access.
//
// FAIL-SAFE: the service returns null / [] for unconfigured Supabase, an
// unapplied migration, a private profile, or RLS denial. This page maps those
// to a composed "לא נמצא" empty state and never throws. All four UI states
// (loading / empty / error / success) are present.
//
// Design system: Fresh Steel / Obsidian (see DESIGN.md + src/styles/tokens.css)
// ============================================================================

import {
  Activity,
  Award,
  BarChart3,
  Bike,
  Calendar,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  type LucideIcon,
  Medal,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  UserRound,
  Waves,
  Weight,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import {
  getPublicProfile,
  getUserAchievements,
  listAchievements,
} from '../../services/profile/profileService';
import type { Achievement, ProfilePublic } from '../../services/profile/types';
import { getInitials } from '../../utils/getInitials';

// ── Badge icon resolver ───────────────────────────────────────────────────
// Achievement.icon is a free-form string from the catalog; the service defaults
// it to 'award'. Resolve to a Lucide component, defaulting to Award (badge
// semantics) rather than the workout IconMap's Dumbbell default.
const BADGE_ICONS: Record<string, LucideIcon> = {
  award: Award,
  medal: Medal,
  trophy: Trophy,
  star: Star,
  flame: Flame,
  zap: Zap,
  target: Target,
  timer: Timer,
  heart: Heart,
  activity: Activity,
  dumbbell: Dumbbell,
  weight: Weight,
  footprints: Footprints,
  bike: Bike,
  waves: Waves,
  calendar: Calendar,
  'bar-chart': BarChart3,
  'trending-up': TrendingUp,
};

const getBadgeIcon = (name: string): LucideIcon => BADGE_ICONS[name] ?? Award;

type LoadState = 'loading' | 'error' | 'ready';

// ── Shared chrome (mirrors AccessibilityStatement page idiom) ───────────────
const SECTION_HEADING_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 16,
  letterSpacing: '-0.01em',
  color: 'var(--fs-ink)',
  margin: '0 0 12px' as const,
};

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--fs-surface)',
  borderRadius: 'var(--radius-asymmetric)',
  padding: '20px',
};

function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  // Mirror the app's back convention (MyCoach / WorkoutDetail / CoachPage): pop
  // in-app history when there is somewhere to pop to, else fall back to the
  // community feed — the list this profile is a detail of — so a cold deep-link
  // to /u/:id is never a dead-end.
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (idx && idx > 0) navigate(-1);
    else navigate('/community');
  };
  return (
    // The wash stays FULL-BLEED: capping the element that paints the
    // background/ambient mesh would shrink it to a 480px strip down the middle
    // of a wide screen. The cap belongs on the <main> column below.
    <div
      className="min-h-screen min-h-[100dvh] ambient-mesh ambient-mesh-soft"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
      lang="he"
    >
      <PageHeader title={title} eyebrow="SparkOS Fitness" onBack={goBack} />
      {/* `.page-shell` (components.css) is the house content container: 480px
          max-width + margin-inline auto + 20px padding-inline + the fixed-nav
          bottom clearance. It replaces the old `px-5` (identical 20px) and the
          hand-rolled `pb-[max(7rem,…)]` that used to sit on the wash. */}
      <main className="page-shell pt-6">{children}</main>
    </div>
  );
}

// ── State views ─────────────────────────────────────────────────────────────
function LoadingView() {
  return (
    <PageShell title="פרופיל ציבורי">
      <div aria-busy="true" aria-label="טוען פרופיל">
        {/* Avatar + name skeleton — matches the success layout shape */}
        <div style={{ ...CARD_STYLE, marginBottom: 20 }}>
          <div className="flex flex-col items-center">
            <div
              className="animate-pulse"
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: 'var(--fs-surface-2)',
                marginBottom: 14,
              }}
            />
            <div
              className="animate-pulse"
              style={{ width: 160, height: 22, borderRadius: 6, background: 'var(--fs-surface-2)' }}
            />
            <div
              className="animate-pulse"
              style={{
                width: 220,
                height: 14,
                borderRadius: 6,
                background: 'var(--fs-surface-2)',
                marginTop: 12,
              }}
            />
          </div>
        </div>
        <div style={CARD_STYLE}>
          <div
            className="animate-pulse"
            style={{ width: 120, height: 16, borderRadius: 6, background: 'var(--fs-surface-2)' }}
          />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {['s1', 's2', 's3'].map((k) => (
              <div
                key={k}
                className="animate-pulse"
                style={{ height: 96, borderRadius: 14, background: 'var(--fs-surface-2)' }}
              />
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function NotFoundView({ onRetry }: { onRetry?: () => void }) {
  return (
    <PageShell title="פרופיל ציבורי">
      <div style={{ ...CARD_STYLE, textAlign: 'center', paddingBlock: 40 }}>
        <div
          className="mx-auto flex items-center justify-center"
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--fs-surface-2)',
            marginBottom: 16,
          }}
        >
          <UserRound size={32} aria-hidden="true" style={{ color: 'var(--fs-muted)' }} />
        </div>
        <h2 style={{ ...SECTION_HEADING_STYLE, textAlign: 'center', margin: '0 0 8px' }}>
          הפרופיל לא נמצא
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--fs-muted)',
            margin: 0,
          }}
        >
          ייתכן שהפרופיל פרטי, הוסר, או שהקישור שגוי.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="active:scale-[0.98]"
            style={{
              marginTop: 20,
              padding: '10px 20px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: 'var(--fs-accent)',
              color: 'var(--color-ink-on-accent)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            נסו שוב
          </button>
        )}
      </div>
    </PageShell>
  );
}

// ── Achievement badge ────────────────────────────────────────────────────────
function BadgeTile({ achievement }: { achievement: Achievement }) {
  const Icon = getBadgeIcon(achievement.icon);
  return (
    <li
      className="flex flex-col items-center text-center"
      style={{
        background: 'var(--fs-surface-2)',
        borderRadius: 14,
        padding: '16px 10px',
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--fs-accent)',
          color: 'var(--color-ink-on-accent)',
          marginBottom: 8,
        }}
      >
        <Icon size={22} aria-hidden="true" strokeWidth={2.2} />
      </span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--fs-ink)',
          lineHeight: 1.3,
        }}
      >
        {achievement.title}
      </span>
      {achievement.description && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--fs-muted)',
            lineHeight: 1.35,
            marginTop: 4,
          }}
        >
          {achievement.description}
        </span>
      )}
    </li>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [state, setState] = useState<LoadState>('loading');
  const [profile, setProfile] = useState<ProfilePublic | null>(null);
  const [badges, setBadges] = useState<Achievement[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is a retry trigger — bumping it re-runs the fetch without being read inside the effect.
  useEffect(() => {
    let active = true;
    if (!userId) {
      setState('error');
      return;
    }
    setState('loading');

    (async () => {
      try {
        // Launch all three reads together — each is fail-safe (returns
        // null/[] rather than throwing), so the badge reads are harmless even
        // when the profile turns out to be missing/private.
        const [p, earned, catalog] = await Promise.all([
          getPublicProfile(userId),
          getUserAchievements(userId),
          listAchievements(),
        ]);
        if (!active) return;
        if (!p) {
          setProfile(null);
          setState('ready');
          return;
        }
        setProfile(p);

        // Resolve earned badges against the catalog for titles/icons.
        const byId = new Map(catalog.map((a) => [a.id, a]));
        const resolved = earned
          .map((e) => byId.get(e.achievementId))
          .filter((a): a is Achievement => a != null);
        setBadges(resolved);
        setState('ready');
      } catch {
        if (active) setState('error');
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  const retry = () => setReloadKey((k) => k + 1);

  if (state === 'loading') return <LoadingView />;
  if (state === 'error') return <NotFoundView onRetry={retry} />;
  if (!profile) return <NotFoundView onRetry={retry} />;

  const name = profile.displayName?.trim() ?? '';
  const initials = getInitials(name);

  return (
    <PageShell title="פרופיל ציבורי">
      {/* Identity card */}
      <section style={{ ...CARD_STYLE, marginBottom: 20 }} aria-label="פרטי פרופיל">
        <div className="flex flex-col items-center text-center">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={name ? `תמונת הפרופיל של ${name}` : 'תמונת פרופיל'}
              width={96}
              height={96}
              loading="lazy"
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                objectFit: 'cover',
                marginBottom: 14,
                background: 'var(--fs-surface-2)',
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex items-center justify-center"
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: 'var(--fs-accent)',
                color: 'var(--color-ink-on-accent)',
                marginBottom: 14,
              }}
            >
              {initials ? (
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 36,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {initials}
                </span>
              ) : (
                <UserRound size={40} />
              )}
            </div>
          )}

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 22,
              color: 'var(--fs-ink)',
              margin: 0,
            }}
          >
            {name || 'משתמש'}
          </h2>

          {profile.bio?.trim() && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--fs-muted)',
                margin: '10px 0 0',
                maxWidth: 360,
              }}
            >
              {profile.bio.trim()}
            </p>
          )}
        </div>
      </section>

      {/* Achievements */}
      <section style={CARD_STYLE} aria-label="הישגים">
        <h2 style={SECTION_HEADING_STYLE}>הישגים</h2>
        {badges.length === 0 ? (
          <div className="flex flex-col items-center text-center" style={{ paddingBlock: 16 }}>
            <Medal
              size={28}
              aria-hidden="true"
              style={{ color: 'var(--fs-muted)', marginBottom: 8 }}
            />
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--fs-muted)',
                margin: 0,
              }}
            >
              עדיין אין הישגים להצגה.
            </p>
          </div>
        ) : (
          <ul
            className="grid grid-cols-3 gap-3"
            style={{ listStyle: 'none', padding: 0, margin: 0 }}
          >
            {badges.map((b) => (
              <BadgeTile key={b.id} achievement={b} />
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
