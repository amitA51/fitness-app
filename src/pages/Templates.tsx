/**
 * SparkOS Fitness - Templates Page (Premium Design System)
 * Double-Bezel Cards, Spring Physics, Staggered Reveals
 */

import { AnimatePresence, m } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
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
    showCleanupConfirm,
    isCleaning,
    requestCleanup,
    cancelCleanup,
    confirmCleanup,
  } = useTemplates();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState onRetry={loadTemplates} />;

  return (
    <>
      <m.div
        className="pb-[88px] ambient-mesh ambient-mesh-soft"
        style={{ background: 'var(--fs-bg)' }}
        dir="rtl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <PageHeader
          title="תבניות"
          eyebrow={
            <>
              <span dir="ltr">{templates.length}</span> תבניות אימון
            </>
          }
          action={
            /* Library maintenance — merge duplicate exercises */
            <button
              type="button"
              onClick={requestCleanup}
              disabled={isCleaning}
              className="focus-ring"
              aria-label="ניקוי תרגילים כפולים"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 44,
                padding: '0 14px',
                flexShrink: 0,
                background: 'var(--fs-surface)',
                border: '1px solid var(--fs-surface-2)',
                borderRadius: 'var(--radius-asymmetric)',
                cursor: isCleaning ? 'progress' : 'pointer',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                opacity: isCleaning ? 0.6 : 1,
              }}
            >
              <Sparkles size={14} aria-hidden="true" />
              {isCleaning ? '...' : 'ניקוי'}
            </button>
          }
        />

        <div className="px-5 pt-5">
          {/* Primary CTA — hidden when the list is empty: the empty state below
              carries its own single "צור תבנית ראשונה" CTA (one label per intent). */}
          {templates.length > 0 && (
            <m.div variants={itemVariants} className="mb-5">
              <m.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateModal(true)}
                className="btn-primary start-workout-btn accent-glow w-full flex items-center justify-center gap-2"
                aria-label="צור תבנית חדשה"
              >
                <Plus size={18} />
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

      <ConfirmDialog
        isOpen={showCleanupConfirm}
        variant="info"
        title="ניקוי כפילויות"
        description="לאחד תרגילים כפולים בספרייה? נשמר התרגיל עם הנתונים העשירים ביותר."
        confirmLabel="נקה"
        cancelLabel="ביטול"
        onConfirm={confirmCleanup}
        onCancel={cancelCleanup}
      />
    </>
  );
}
