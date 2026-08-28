// ============================================================================
// ReadinessReadingCard — the first USER-FACING consumer of trainingLoadService.
// ============================================================================
// trainingLoadService is ~900 lines of tested deterministic coaching math whose
// only readers were LLM prompt strings (ai/contextBuilder.ts interpolates
// readinessScore into Hebrew prompt text). Nothing on screen changed when a user
// filled in a recovery log. This card is the deterministic reader: it renders a
// TrainingLoadResult as-is. No model call, no network — math rendered as text.
//
// WHY THE HEDGE IS THE WHOLE POINT
// A previous card (CoachBriefCard) printed a confident 92/100 and was deleted:
// with no recovery log every penalty was inert, so the figure was effectively
// two-valued — 92 if you trained this week, 67 if you did not. The engine was
// never the problem; it already reports WHICH inputs were real. This card obeys
// those three flags instead of printing over them:
//
//   • !hasRecoveryData    → NO number and NO recommendation. Without a log the
//     recovery penalty is a hard-coded default, so there is no reading to show.
//     The card says that plainly and names the one action that creates one.
//     This flag TAKES PRECEDENCE: when no reading is shown, caveats about the
//     other two inputs would be footnotes on a computation we are withholding.
//   • !hasRpeData         → reading shown, badged 'קריאה חלקית', the assumed
//     effort (RPE 7) named, logging RPE offered as the sharpener.
//   • !hasChronicBaseline → reading shown, badged 'קריאה חלקית', the load-vs-
//     baseline row SUPPRESSED (its ratio is meaningless without a prior week),
//     and a second week of history named as what fixes it.
//
// Copy register is plural-imperative ('מלאו', 'רשמו') per guidanceSteps.tsx.
// Every number renders dir="ltr" inside the RTL layout.

import { Activity, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';
import type { TrainingLoadResult } from '../../../services/trainingLoadService';
import { type Zone, zoneColor } from '../../../utils/zoneColor';
import { SectionCard } from './SectionCard';

/** The effort the engine assumes for a set with no logged RPE (DEFAULT_RPE_FACTOR 0.7). */
const ASSUMED_RPE = 7;

const READINESS_LABEL: Record<TrainingLoadResult['readinessLabel'], string> = {
  high: 'מוכנות גבוהה',
  good: 'מוכנות טובה',
  moderate: 'מוכנות בינונית',
  low: 'מוכנות נמוכה',
};

const READINESS_ZONE: Record<TrainingLoadResult['readinessLabel'], Zone> = {
  high: 'good',
  good: 'good',
  moderate: 'neutral',
  low: 'attention',
};

const RECOMMENDATION_TEXT: Record<TrainingLoadResult['recommendation'], string> = {
  push: 'העלו עומס באימון הבא',
  maintain: 'שמרו על העומס הנוכחי',
  deload: 'הפחיתו עומס באימון הבא',
  rest: 'קחו יום מנוחה',
};

const RECOMMENDATION_ZONE: Record<TrainingLoadResult['recommendation'], Zone> = {
  push: 'good',
  maintain: 'neutral',
  deload: 'attention',
  rest: 'attention',
};

const CONSTRAINT_REASON: Record<TrainingLoadResult['primaryConstraint'], string> = {
  recovery: 'מה שמגביל אתכם עכשיו זו ההתאוששות שדיווחתם, לא העומס.',
  load_spike: 'מה שמגביל אתכם עכשיו זה זינוק בנפח האימון מול השבוע הקודם.',
  high_rpe: 'מה שמגביל אתכם עכשיו זה מאמץ (RPE) ממוצע גבוה באימוני השבוע.',
  low_volume: 'מה שמגביל אתכם עכשיו זה היעדר נפח אימון בשבוע האחרון.',
  balanced: 'אין גורם מגביל בולט — העומס וההתאוששות מאוזנים.',
};

/** A caveat row: what the engine had to assume, and what would remove the assumption. */
function HedgeNote({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: 12,
        lineHeight: 1.6,
        color: 'var(--fs-muted)',
      }}
    >
      <Info size={13} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 3 }} />
      <span>{children}</span>
    </p>
  );
}

function CardTitle() {
  return (
    <h3
      className="section-title flex items-center gap-2"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '-0.01em',
        color: 'var(--fs-muted)',
        marginBlockEnd: 14,
      }}
    >
      <Activity size={14} aria-hidden="true" />
      קריאת מוכנות
    </h3>
  );
}

export const ReadinessReadingCard = memo(function ReadinessReadingCard({
  load,
}: {
  load: TrainingLoadResult;
}) {
  // No recovery log → the readiness number was built on a default penalty. Show
  // the absence, not the number. (This is the exact failure that got the old
  // CoachBriefCard deleted.)
  if (!load.hasRecoveryData) {
    return (
      <SectionCard style={{ padding: 20 }}>
        <CardTitle />
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.5,
            color: 'var(--fs-ink)',
            marginBlockEnd: 8,
          }}
        >
          אין עדיין קריאת מוכנות
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--fs-muted)' }}>
          בלי דיווח התאוששות החישוב מסתמך על ערך ברירת מחדל, ומספר כזה לא מספר עליכם כלום — לכן הוא
          לא מוצג. מלאו דיווח התאוששות (שינה, כאב שרירים, אנרגיה ולחץ) והקריאה תופיע כאן מיד, יחד עם
          המלצת העומס לאימון הבא.
        </p>
      </SectionCard>
    );
  }

  const isPartial = !load.hasRpeData || !load.hasChronicBaseline;
  const readinessColor = zoneColor(READINESS_ZONE[load.readinessLabel]);
  const recommendationColor = zoneColor(RECOMMENDATION_ZONE[load.recommendation]);

  return (
    <SectionCard style={{ padding: 20 }}>
      <CardTitle />

      {/* The reading. Number is LTR-isolated inside the RTL column. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span
          dir="ltr"
          style={{
            fontSize: 40,
            fontWeight: 900,
            lineHeight: 1,
            color: readinessColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {load.readinessScore}
        </span>
        <span dir="ltr" style={{ fontSize: 13, color: 'var(--fs-muted)' }}>
          / 100
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: readinessColor }}>
          {READINESS_LABEL[load.readinessLabel]}
        </span>
        {isPartial && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'var(--fs-surface-2)',
              color: 'var(--fs-muted)',
            }}
          >
            קריאה חלקית
          </span>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--fs-muted)', marginBlockStart: 8 }}>
        מחושב מדיווח ההתאוששות האחרון שלכם ומאימוני השבוע.
      </p>

      {/* The recommendation — the actionable half of the reading. */}
      <p
        style={{
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.5,
          color: recommendationColor,
          borderInlineStart: `3px solid ${recommendationColor}`,
          paddingInlineStart: 10,
          marginBlockStart: 16,
        }}
      >
        {RECOMMENDATION_TEXT[load.recommendation]}
      </p>

      <p
        style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--fs-ink)',
          marginBlockStart: 10,
        }}
      >
        {CONSTRAINT_REASON[load.primaryConstraint]}
      </p>

      {/* Load vs the 3-week baseline. Suppressed without a baseline: the ratio
          falls back to 1.0 there, which would read as "right on target". */}
      {load.hasChronicBaseline && (
        <p style={{ fontSize: 12, color: 'var(--fs-muted)', marginBlockStart: 10 }}>
          עומס השבוע מול הבסיס:{' '}
          <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {load.acuteChronicRatio.toFixed(2)}
          </span>
        </p>
      )}

      {isPartial && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBlockStart: 14,
            paddingBlockStart: 14,
            borderBlockStart: '1px solid var(--fs-surface-2)',
          }}
        >
          {!load.hasRpeData && (
            <HedgeNote>
              לא רשמתם RPE באימוני השבוע, ולכן החישוב הניח מאמץ בינוני של{' '}
              <span dir="ltr">{ASSUMED_RPE}</span>. רשמו RPE בסטים כדי לחדד את הקריאה.
            </HedgeNote>
          )}
          {!load.hasChronicBaseline && (
            <HedgeNote>
              אין עדיין שבוע היסטוריה לפני השבוע הנוכחי, ולכן אי אפשר להשוות את העומס לבסיס. עוד
              שבוע של אימונים והשוואת העומס תיכנס לקריאה.
            </HedgeNote>
          )}
        </div>
      )}
    </SectionCard>
  );
});

export default ReadinessReadingCard;
