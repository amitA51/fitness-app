import { m } from 'framer-motion';
import { Dumbbell, Plus } from 'lucide-react';
import type { WorkoutTemplate } from '../../../types';
import { itemVariants, springTransition } from '../constants';
import { TemplateCard } from './TemplateCard';

interface TemplateListProps {
  favorites: WorkoutTemplate[];
  regular: WorkoutTemplate[];
  deletingIds: Set<string>;
  favoritingIds: Set<string>;
  onStart: (templateId: string) => void;
  onToggleFavorite: (template: WorkoutTemplate) => void;
  onDuplicate: (template: WorkoutTemplate) => void;
  onDelete: (id: string) => void;
  onCreateClick: () => void;
}

export function TemplateList({
  favorites,
  regular,
  deletingIds,
  favoritingIds,
  onStart,
  onToggleFavorite,
  onDuplicate,
  onDelete,
  onCreateClick,
}: TemplateListProps) {
  const hasTemplates = favorites.length > 0 || regular.length > 0;

  return (
    <>
      {/* Empty State */}
      {!hasTemplates && (
        <m.div
          variants={itemVariants}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <m.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...springTransition, delay: 0.2 }}
            className="w-20 h-20 mb-6 flex items-center justify-center"
            style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
          >
            <Dumbbell size={36} />
          </m.div>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            אין תבניות עדיין
          </p>
          <p
            className="eyebrow mb-3"
            style={{ color: 'var(--fs-muted)', maxWidth: '28ch', lineHeight: 1.5 }}
          >
            תבנית = רשימת תרגילים מוכנה. צרו אחת עכשיו — ואז תוכלו להתחיל אימון בלחיצה.
          </p>
          <m.button
            whileTap={{ scale: 0.95 }}
            onClick={onCreateClick}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            צור תבנית ראשונה
          </m.button>
        </m.div>
      )}

      {/* Favorites Section */}
      {favorites.length > 0 && (
        <m.div variants={itemVariants} className="mb-6">
          <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
            <span className="left" />
            <span
              className="right"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16,
                color: 'var(--color-ink-on-dark)',
              }}
            >
              מועדפים
            </span>
          </div>
          <div className="flex flex-col gap-4 mt-4">
            {favorites.map((template, index) => (
              <TemplateCard
                key={template.id}
                template={template}
                index={index}
                onStart={onStart}
                onToggleFavorite={onToggleFavorite}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isDeleting={deletingIds.has(template.id)}
                isFavoriting={favoritingIds.has(template.id)}
              />
            ))}
          </div>
        </m.div>
      )}

      {/* All Templates Section */}
      {regular.length > 0 && (
        <m.div variants={itemVariants} className="mb-6">
          {favorites.length > 0 && (
            <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
              <span className="left" />
              <span
                className="right"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 16,
                  color: 'var(--color-ink-on-dark)',
                }}
              >
                כל התבניות
              </span>
            </div>
          )}
          <div className="flex flex-col gap-4 mt-4">
            {regular.map((template, index) => (
              <TemplateCard
                key={template.id}
                template={template}
                index={favorites.length + index}
                onStart={onStart}
                onToggleFavorite={onToggleFavorite}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isDeleting={deletingIds.has(template.id)}
                isFavoriting={favoritingIds.has(template.id)}
              />
            ))}
          </div>
        </m.div>
      )}
    </>
  );
}
