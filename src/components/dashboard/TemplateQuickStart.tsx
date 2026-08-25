import { memo, useCallback } from 'react';
import type { WorkoutTemplate } from '../../types';

interface TemplateItemProps {
  template: WorkoutTemplate;
  onClick: () => void;
}

export const TemplateItem = memo(function TemplateItem({ template, onClick }: TemplateItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="template-card magnetic-card"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        minWidth: 130,
        flexShrink: 0,
        scrollSnapAlign: 'start',
        whiteSpace: 'nowrap',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: 'var(--radius-card)',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--fs-accent)',
          letterSpacing: '-0.01em',
          marginInlineStart: 4,
        }}
        aria-hidden="true"
      >
        ·
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--fs-ink)',
          letterSpacing: '0.04em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {template.name}
      </span>
    </button>
  );
});

interface TemplateStripProps {
  templates: WorkoutTemplate[];
  onNavigate: (path: string) => void;
}

/** Wrapper that creates a stable onClick for each TemplateItem */
const TemplateItemWithNav = memo(function TemplateItemWithNav({
  template,
  onNavigate,
}: {
  template: WorkoutTemplate;
  onNavigate: (path: string) => void;
}) {
  const handleClick = useCallback(
    () => onNavigate(`/workout/${template.id}`),
    [onNavigate, template.id]
  );
  return <TemplateItem template={template} onClick={handleClick} />;
});

export const TemplateStrip = memo(function TemplateStrip({
  templates,
  onNavigate,
}: TemplateStripProps) {
  const handleShowAll = useCallback(() => onNavigate('/templates'), [onNavigate]);

  if (templates.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        padding: '4px 0',
        scrollbarWidth: 'none',
        // Light, non-jarring snap so the horizontal strip settles on a card edge.
        scrollSnapType: 'x proximity',
      }}
      className="no-scrollbar"
    >
      {templates.slice(0, 5).map((t) => (
        <TemplateItemWithNav key={t.id} template={t} onNavigate={onNavigate} />
      ))}
      {templates.length > 5 && (
        <button
          type="button"
          onClick={handleShowAll}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 14px',
            flexShrink: 0,
            scrollSnapAlign: 'start',
            background: 'var(--fs-surface-2)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: 'var(--radius-card)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--fs-muted)',
            fontWeight: 600,
          }}
        >
          +{templates.length - 5}
        </button>
      )}
    </div>
  );
});
