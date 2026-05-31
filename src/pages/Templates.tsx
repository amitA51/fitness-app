/**
 * SparkOS Fitness - Templates Page (Premium Design System)
 * Double-Bezel Cards, Spring Physics, Staggered Reveals
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
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
      <motion.div
        className="pb-[88px] ambient-mesh ambient-mesh-soft"
        style={{ background: 'var(--fs-bg)' }}
        dir="rtl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <header
          style={{
            paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
            paddingLeft: 'max(20px, env(safe-area-inset-left, 20px))',
            paddingRight: 'max(20px, env(safe-area-inset-right, 20px))',
            paddingBottom: 16,
            position: 'sticky',
            top: 0,
            zIndex: 20,
            background: 'var(--fs-bg)',
            borderBottom: '2px solid var(--fs-accent)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--fs-muted)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {templates.length} תבניות אימון
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 26,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: 'var(--fs-ink)',
              margin: '4px 0 0',
            }}
          >
            תבניות
          </h1>
        </header>

        <div className="px-5 pt-5">
          {/* Primary CTA */}
          <motion.div variants={itemVariants} className="mb-5">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreateModal(true)}
              className="btn-primary start-workout-btn accent-glow w-full flex items-center justify-center gap-2"
              aria-label="צור תבנית חדשה"
            >
              <Plus size={18} />+ תבנית חדשה
            </motion.button>
          </motion.div>

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
      </motion.div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateTemplateModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>
    </>
  );
}
