// This week's running distance against the weekly goal.

import { Pencil } from 'lucide-react';
import { UNIT_KM, formatKm } from '../../../../utils/cardio';
import { SectionCard } from '../../components/SectionCard';
import { mutedStyle, titleStyle } from './styles';

export function WeekGoalCard({
  weekKm,
  goal,
  onEditGoal,
}: {
  weekKm: number;
  goal: number | null;
  onEditGoal: () => void;
}) {
  return (
    <SectionCard>
      <div style={{ display: 'grid', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <h3 style={titleStyle}>ריצה השבוע</h3>
          <button
            type="button"
            className="cta-ghost focus-ring"
            style={{ minHeight: 44, paddingInline: 8 }}
            onClick={onEditGoal}
          >
            <Pencil size={14} aria-hidden="true" style={{ marginInlineEnd: 6 }} />
            {goal ? 'שינוי יעד' : 'הגדרת יעד'}
          </button>
        </div>
        <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            className="kinetic-number"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 40,
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--fs-ink)',
            }}
          >
            {formatKm(weekKm)}
          </span>
          {goal && (
            <span
              className="kinetic-number"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                color: 'var(--fs-muted)',
              }}
            >
              / {formatKm(goal)}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--fs-muted)' }}>
            {UNIT_KM}
          </span>
        </p>
        {goal ? (
          <>
            <span
              aria-hidden="true"
              style={{
                display: 'flex',
                height: 8,
                borderRadius: 'var(--radius-full)',
                background: 'var(--fs-surface-2)',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  width: `${Math.min(100, Math.round((weekKm / goal) * 100))}%`,
                  background: 'var(--fs-accent)',
                  borderRadius: 'inherit',
                }}
              />
            </span>
            <p style={mutedStyle}>
              {weekKm >= goal ? (
                'עמדתם ביעד השבועי.'
              ) : (
                <>
                  נשארו <span className="kinetic-number">{formatKm(goal - weekKm)}</span> {UNIT_KM}{' '}
                  ליעד.
                </>
              )}
            </p>
          </>
        ) : (
          <p style={mutedStyle}>יעד שבועי עוזר להתמיד. הגדילו אותו בהדרגה.</p>
        )}
      </div>
    </SectionCard>
  );
}
