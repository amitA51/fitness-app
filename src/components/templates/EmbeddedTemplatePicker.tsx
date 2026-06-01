// ============================================================================
// EmbeddedTemplatePicker — read-only template list for embedding inside other
// surfaces (e.g. the exercise selector's "templates" tab).
// ============================================================================
// Part of the template-manager consolidation: the former duplicate manager
// (components/workout/WorkoutTemplates.tsx) was removed. Its full CRUD lives in
// the canonical Templates page (pages/Templates.tsx + useTemplates). This picker
// is the lightweight, pick-only slice for "choose a template to pull exercises
// from" — it owns NO CRUD, just loads templates and reports the chosen one.
// Built on the canonical Card primitive, token colors, RTL-correct, ≥44px rows.

import { ChevronLeft, Dumbbell } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useIsRTL } from '../../hooks/useIsRTL';
import { onTemplatesChanged } from '../../services/dataEvents';
import { getWorkoutTemplates } from '../../services/workoutDb';
import type { WorkoutTemplate } from '../../types';
import { logger } from '../../utils/logger';
import { Card } from '../ui/Card';
import { SkeletonBox } from '../ui/SkeletonLoader';

interface EmbeddedTemplatePickerProps {
  /** Called with the chosen template (favorites are surfaced first). */
  onSelectTemplate: (template: WorkoutTemplate) => void;
}

const estimateDurationLabel = (template: WorkoutTemplate): string => {
  const totalSets = template.exercises.reduce(
    (sum, ex) => sum + (ex.sets?.length || ex.targetSets || 3),
    0
  );
  const mins = totalSets * 3;
  return mins < 60 ? `${mins} דק׳` : `${Math.round(mins / 60)} שעה`;
};

const TemplateRow = memo(function TemplateRow({
  template,
  onSelect,
}: {
  template: WorkoutTemplate;
  onSelect: (template: WorkoutTemplate) => void;
}) {
  const isRTL = useIsRTL();
  return (
    <Card variant="elevated" asymmetric noPadding interactive className="fs-accent-rail">
      <button
        type="button"
        onClick={() => onSelect(template)}
        className="focus-ring"
        aria-label={`בחר תבנית ${template.name}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          minHeight: 64,
          padding: '14px 16px',
          textAlign: 'start',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 14,
            background: 'var(--fs-surface-2)',
            color: 'var(--fs-accent)',
          }}
        >
          <Dumbbell size={20} aria-hidden="true" />
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
          <span
            className="line-clamp-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 16,
              color: 'var(--fs-heading)',
              letterSpacing: '-0.01em',
            }}
          >
            {template.name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-muted)',
              letterSpacing: '0.04em',
            }}
          >
            {template.exercises.length} תרגילים · {estimateDurationLabel(template)}
          </span>
        </span>
        <ChevronLeft
          size={18}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: 'var(--fs-muted)',
            transform: isRTL ? undefined : 'rotate(180deg)',
          }}
        />
      </button>
    </Card>
  );
});

export const EmbeddedTemplatePicker = memo(function EmbeddedTemplatePicker({
  onSelectTemplate,
}: EmbeddedTemplatePickerProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await getWorkoutTemplates();
        if (mounted) setTemplates(data);
      } catch (err) {
        logger.workout.warn('Failed to load templates in picker', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    const off = onTemplatesChanged(load);
    return () => {
      mounted = false;
      off();
    };
  }, []);

  const sorted = useMemo(
    () => [...templates.filter((t) => t.isFavorite), ...templates.filter((t) => !t.isFavorite)],
    [templates]
  );

  if (isLoading && templates.length === 0) {
    return (
      <output
        aria-live="polite"
        aria-label="טוען תבניות"
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} height={64} borderRadius="var(--radius-asymmetric)" />
        ))}
      </output>
    );
  }

  if (sorted.length === 0) {
    return (
      <Card variant="sunken" asymmetric style={{ padding: '32px 20px', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 16,
            color: 'var(--fs-ink)',
            marginBottom: 6,
          }}
        >
          אין תבניות עדיין
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
            letterSpacing: '0.04em',
          }}
        >
          צור תבנית בעמוד התבניות
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((template) => (
        <TemplateRow key={template.id} template={template} onSelect={onSelectTemplate} />
      ))}
    </div>
  );
});

export default EmbeddedTemplatePicker;
