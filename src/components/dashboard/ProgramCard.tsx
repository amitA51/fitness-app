// ============================================================================
// ProgramCard — trainee Dashboard card for the built-in 12-week program
// Fresh Steel / Obsidian design system
// ============================================================================
// Surfaces the self-guided "Bodybuilding Transformation System" on the home
// screen so the program is discoverable from the Dashboard, not only from the
// /program route. Three states:
//   • not started  → an invitation to begin the 12-week program
//   • active       → current week/day + block + progress, "המשך לתוכנית" CTA
//   • completed    → a quiet celebration line
// Reads localStorage progress WITHOUT mutating it (getProgress, never
// startProgram), so merely viewing the Dashboard never silently enrolls the
// trainee. Tokens only; numerals are bidi-isolated for the RTL layout.

import { ChevronLeft, Sparkles, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BBT_PROGRAM_METADATA,
  getBlockForWeek,
  getProgramDayMetadata,
} from '../../data/bbtProgramMetadata';
import { TRAINING_DAYS, getProgress } from '../../services/programProgressService';
import { Card } from '../ui/Card';

// The Dashboard only needs progress plus compact labels/counts. The full BBT
// exercise catalog is 339 kB source / ~218 kB emitted, so this card must never
// resolve it on mount: a trainee who never opens /program should not download it.
// Keeping the async refresh preserves the existing aria-busy skeleton first paint.

type ProgramView =
  | { kind: 'loading' }
  | { kind: 'not-started'; totalWeeks: number; titleHe: string }
  | {
      kind: 'active';
      week: number;
      dayHe: string;
      blockHe: string;
      exerciseCount: number;
      completedCount: number;
      totalDays: number;
      pct: number;
    }
  | { kind: 'completed'; totalWeeks: number };

// Resolves entirely from small, eagerly available metadata plus local progress.
// It intentionally remains async so the existing skeleton and focus/visibility
// refresh behavior stay unchanged without scheduling the generated catalog.
async function computeProgramView(): Promise<ProgramView> {
  const totalDays = BBT_PROGRAM_METADATA.totalWeeks * TRAINING_DAYS.length;
  const progress = getProgress();
  if (!progress)
    return {
      kind: 'not-started',
      totalWeeks: BBT_PROGRAM_METADATA.totalWeeks,
      titleHe: BBT_PROGRAM_METADATA.titleHe,
    };
  if (progress.status === 'completed') {
    return { kind: 'completed', totalWeeks: BBT_PROGRAM_METADATA.totalWeeks };
  }

  const dayType = TRAINING_DAYS[progress.currentDayIndex] ?? 'Upper';
  const day = getProgramDayMetadata(progress.currentWeek, dayType);
  const block = getBlockForWeek(progress.currentWeek);
  const completedCount = progress.completed.length;

  return {
    kind: 'active',
    week: progress.currentWeek,
    dayHe: day?.dayHe ?? dayType,
    blockHe: block.nameHe,
    exerciseCount: day?.exerciseCount ?? 0,
    completedCount,
    totalDays,
    pct: Math.round((completedCount / totalDays) * 100),
  };
}

const kicker = (text: string) => (
  <span
    style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '-0.01em',
      color: 'var(--fs-accent-2)',
    }}
  >
    {text}
  </span>
);

export function ProgramCard() {
  const navigate = useNavigate();
  const [view, setView] = useState<ProgramView>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    // Re-read on return-to-tab: finishing a program day advances the pointer via
    // the save-flow reconcile, so the card should reflect it when the user comes
    // back to the Dashboard. Both reads are tiny synchronous metadata/progress
    // lookups, so focus and visibility refreshes remain cheap.
    const refresh = () => {
      computeProgramView().then((next) => {
        if (active) setView(next);
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const goToProgram = () => navigate('/program');

  // ── Loading (metadata refresh resolves just after mount) ───────────────────
  if (view.kind === 'loading') {
    return (
      <Card
        asymmetric
        role="region"
        aria-label="תוכנית האימון"
        aria-busy="true"
        style={{ marginTop: 16, padding: 18 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton" style={{ height: 12, width: '42%', borderRadius: 6 }} />
          <div className="skeleton" style={{ height: 20, width: '68%', borderRadius: 6 }} />
          <div className="skeleton" style={{ height: 6, width: '100%', borderRadius: 999 }} />
          <div
            className="skeleton"
            style={{ height: 46, width: '100%', borderRadius: 'var(--radius-md)' }}
          />
        </div>
      </Card>
    );
  }

  // ── Completed ─────────────────────────────────────────────────────────────
  if (view.kind === 'completed') {
    return (
      <Card
        asymmetric
        role="region"
        aria-label="תוכנית האימון"
        style={{ marginTop: 16, padding: 18 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--fs-signal)',
              color: 'var(--color-ink-on-accent)',
              flexShrink: 0,
            }}
          >
            <Trophy size={22} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {kicker('הושלם')}
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 17,
                color: 'var(--fs-ink)',
                lineHeight: 1.2,
                marginTop: 2,
              }}
            >
              סיימת את כל {view.totalWeeks} השבועות
            </div>
          </div>
          <button
            type="button"
            onClick={goToProgram}
            className="focus-ring active:scale-[0.98]"
            aria-label="פתיחת תוכנית האימון"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              minHeight: 44,
              padding: '8px 10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '-0.01em',
              color: 'var(--fs-accent-2)',
              flexShrink: 0,
            }}
          >
            פתח
            <ChevronLeft size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
          </button>
        </div>
      </Card>
    );
  }

  // ── Not started ───────────────────────────────────────────────────────────
  if (view.kind === 'not-started') {
    return (
      <Card asymmetric noPadding style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={goToProgram}
          className="focus-ring active:scale-[0.99]"
          aria-label="התחל את תוכנית האימון בת 12 השבועות"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            width: '100%',
            padding: '18px 20px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'start',
            color: 'inherit',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'var(--fs-accent)',
              color: 'var(--color-ink-on-accent)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={24} />
          </span>
          <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            {kicker(`${view.totalWeeks} שבועות · 5 אימונים בשבוע`)}
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 17,
                color: 'var(--fs-ink)',
                lineHeight: 1.2,
              }}
            >
              תוכנית האימון
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--fs-muted)',
                lineHeight: 1.4,
              }}
            >
              התקדמות מודרכת לפי RPE — התחילו את {view.titleHe}.
            </span>
          </span>
          <ChevronLeft
            size={20}
            aria-hidden="true"
            style={{ color: 'var(--fs-muted)', flexShrink: 0 }}
          />
        </button>
      </Card>
    );
  }

  // ── Active ────────────────────────────────────────────────────────────────
  return (
    <Card
      asymmetric
      role="region"
      aria-label="תוכנית האימון"
      style={{ marginTop: 16, padding: 18 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--fs-muted)',
            }}
          >
            <bdi dir="ltr">
              {view.completedCount}/{view.totalDays}
            </bdi>{' '}
            · <span dir="ltr">{view.pct}%</span>
          </span>
        </div>

        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--fs-ink)',
              lineHeight: 1.2,
            }}
          >
            שבוע {view.week} · {view.dayHe}
          </div>
          <div style={{ color: 'var(--fs-muted)', fontSize: 13, marginTop: 2 }}>
            {view.exerciseCount} תרגילים · {view.blockHe}
          </div>
        </div>

        {/* Progress bar — fills left→right (week 1 → 12) to read as forward time
            even under the RTL page. */}
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: 'var(--fs-surface-2)',
            overflow: 'hidden',
            direction: 'ltr',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${view.pct}%`,
              background: 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))',
              borderRadius: 999,
            }}
          />
        </div>

        <button
          type="button"
          onClick={goToProgram}
          className="focus-ring active:scale-[0.98]"
          aria-label="המשך לתוכנית האימון"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            minHeight: 46,
            padding: '12px 16px',
            background: 'var(--fs-accent)',
            border: '2px solid var(--fs-accent)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            color: 'var(--color-ink-on-accent)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          המשך לתוכנית
          <ChevronLeft size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
        </button>
      </div>
    </Card>
  );
}

export default ProgramCard;
