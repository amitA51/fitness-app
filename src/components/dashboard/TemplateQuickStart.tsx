import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutTemplate } from '../../types';

interface TemplateQuickStartProps {
  onQuickStart: () => void;
}

export const TemplateQuickStart = memo(function TemplateQuickStart({
  onQuickStart,
}: TemplateQuickStartProps) {
  const navigate = useNavigate();

  return (
    <>
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button type="button" onClick={onQuickStart} className="btn-primary focus-ring">
          התחל אימון
        </button>
        <button
          type="button"
          onClick={() => navigate('/templates')}
          className="btn-secondary focus-ring"
        >
          תבניות
        </button>
      </div>
    </>
  );
});

interface TemplateItemProps {
  template: WorkoutTemplate;
  onClick: () => void;
}

export const TemplateItem = memo(function TemplateItem({ template, onClick }: TemplateItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="chip focus-ring"
      style={{
        padding: '8px 12px',
        minWidth: 120,
        display: 'inline-flex',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--mustard)',
          letterSpacing: '0.2em',
          marginLeft: 6,
        }}
      >
        §
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--navy)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
        className="line-clamp-1"
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

export const TemplateStrip = memo(function TemplateStrip({
  templates,
  onNavigate,
}: TemplateStripProps) {
  if (templates.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto no-scrollbar fade-x"
      style={{ marginTop: 12, padding: '4px 0' }}
    >
      {templates.slice(0, 5).map((t) => (
        <TemplateItem key={t.id} template={t} onClick={() => onNavigate(`/workout/${t.id}`)} />
      ))}
      {templates.length > 5 && (
        <button
          type="button"
          onClick={() => onNavigate('/templates')}
          className="chip focus-ring"
          style={{ padding: '8px 12px', flexShrink: 0 }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--navy)',
            }}
          >
            +{templates.length - 5}
          </span>
        </button>
      )}
    </div>
  );
});
