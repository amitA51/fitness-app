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
          className="flex flex-col items-center justify-center py-16 text-center px-2"
        >
          <m.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...springTransition, delay: 0.1 }}
            className="w-16 h-16 mb-6 flex items-center justify-center"
            style={{
              background: 'color-mix(in srgb, var(--fs-accent) 16%, transparent)',
              color: 'var(--fs-accent)',
              borderRadius: 9999,
            }}
          >
            <Dumbbell size={28} strokeWidth={1.75} />
          </m.div>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--fs-ink)',
              letterSpacing: '-0.022em',
              marginBottom: 8,
              lineHeight: 1.15,
            }}
          >
            אין תבניות עדיין
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--fs-muted)',
              maxWidth: '30ch',
              lineHeight: 1.5,
              letterSpacing: '-0.01em',
              marginBottom: 20,
            }}
          >
            תבנית = רשימת תרגילים מוכנה. צרו אחת עכשיו — ואז תוכלו להתחיל אימון בלחיצה.
          </p>
          <m.button
            whileTap={{ scale: 0.98 }}
            onClick={onCreateClick}
            className="start-workout-btn"
            style={{ maxWidth: 320 }}
          >
            <Plus size={18} strokeWidth={2.25} />
            צור תבנית ראשונה
          </m.button>
        </m.div>
      )}

      {/* Favorites Section */}
      {favorites.length > 0 && (
        <m.div variants={itemVariants} className="section-block mb-2">
          <div className="section-heading">
            <h2 className="section-heading-title">מועדפים</h2>
          </div>
          <div className="flex flex-col gap-3">
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
        <m.div variants={itemVariants} className="section-block mb-2">
          {favorites.length > 0 && (
            <div className="section-heading">
              <h2 className="section-heading-title">כל התבניות</h2>
            </div>
          )}
          <div className="flex flex-col gap-3">
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
