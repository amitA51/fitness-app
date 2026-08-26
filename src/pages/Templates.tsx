/**
 * SparkOS Fitness - Templates Page (Premium Design System)
 * Double-Bezel Cards, Spring Physics, Staggered Reveals
 */

import { AnimatePresence, m } from 'framer-motion';
import { Plus } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { useCloudTemplateReflection } from '../hooks/useCloudTemplateReflection';
import { CreateTemplateModal } from './templates/components/CreateTemplateModal';
import { TemplateList } from './templates/components/TemplateList';
import { ErrorState, LoadingState } from './templates/components/TemplateStates';
import { containerVariants, itemVariants } from './templates/constants';
import { useTemplates } from './templates/hooks/useTemplates';

export default function Templates() {
  useCloudTemplateReflection();

  const {
    templates,
    isLoading,
    error,
    showCreateModal,
    setShowCreateModal,
    deletingIds,
    favoritingIds,
    favorites,
    regular,
    loadTemplates,
    handleCreate,
    handleToggleFavorite,
    handleDelete,
    handleDuplicate,
    handleStartTemplate,
  } = useTemplates();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState onRetry={loadTemplates} />;

  return (
    <>
      <m.div
        style={{ background: 'var(--fs-bg)' }}
        dir="rtl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header — count eyebrow only. Library maintenance (duplicate-exercise
            merge) was removed from the header: a maintenance action sitting in
            the page chrome read as a primary action and confused the IA. */}
        <PageHeader
          title="תבניות"
          eyebrow={
            <>
              <span dir="ltr">{templates.length}</span> תבניות אימון
            </>
          }
        />

        <div className="page-shell page-stack" style={{ paddingTop: 12 }}>
          {templates.length > 0 && (
            <m.div variants={itemVariants} className="fs-tip-banner">
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 16,
                  letterSpacing: '-0.015em',
                  color: 'var(--fs-ink)',
                  margin: '0 0 4px',
                }}
              >
                בחרו תבנית ולחצו &quot;התחל אימון&quot;
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  lineHeight: 1.45,
                  letterSpacing: '-0.01em',
                  color: 'var(--fs-muted)',
                  margin: 0,
                }}
              >
                תבנית = רשימת תרגילים מוכנה. אחרי הלחיצה תעברו ישר לאימון.
              </p>
            </m.div>
          )}

          {templates.length > 0 && (
            <m.div variants={itemVariants}>
              <m.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateModal(true)}
                className="cta-secondary"
                aria-label="צור תבנית חדשה"
              >
                <Plus size={18} strokeWidth={2.25} />
                תבנית חדשה
              </m.button>
            </m.div>
          )}

          <TemplateList
            favorites={favorites}
            regular={regular}
            deletingIds={deletingIds}
            favoritingIds={favoritingIds}
            onStart={handleStartTemplate}
            onToggleFavorite={handleToggleFavorite}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onCreateClick={() => setShowCreateModal(true)}
          />
        </div>
      </m.div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateTemplateModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>
    </>
  );
}
