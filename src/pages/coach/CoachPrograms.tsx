// ============================================================================
// COACH PROGRAMS — the coach's program library (the תוכניות tab).
// Lists saved coach_program_templates; builds new ones via ProgramBuilder in
// library mode (no client — assignment happens from the client/group screens).
// ============================================================================

import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import { showToast } from '../../components/ui/GlobalToast';
import {
  deleteProgramTemplate,
  listProgramTemplates,
} from '../../services/coach/programTemplateService';
import type { CoachProgramTemplate } from '../../types/coach';
import ProgramBuilder from './ProgramBuilder';
import { CoachPage, ListRow, ListSkeleton, Section, SectionError, useAsyncData } from './_shared';

export default function CoachPrograms() {
  const navigate = useNavigate();
  const {
    data: templates,
    loading,
    error,
    reload,
  } = useAsyncData<CoachProgramTemplate[]>(() => listProgramTemplates(), []);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CoachProgramTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error: err } = await deleteProgramTemplate(pendingDelete.id);
      if (err) {
        showToast('מחיקת התוכנית נכשלה', 'error');
      } else {
        showToast('התוכנית נמחקה', 'success');
        reload();
      }
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <CoachPage
      title="ספריית התוכניות"
      subtitle="Programs"
      onBack={() => navigate('/coach')}
      actions={
        <Button
          variant="primary"
          size="icon"
          aria-label="תוכנית חדשה"
          onClick={() => setBuilderOpen(true)}
          className="shrink-0"
          style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
        >
          <Plus size={18} aria-hidden="true" />
        </Button>
      }
    >
      <Section title="התוכניות שלי">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <SectionError onRetry={reload} />
        ) : templates.length === 0 ? (
          <EmptyState
            illustration="generic"
            title="עדיין אין תוכניות בספרייה"
            description="בנה תוכנית פעם אחת ושייך אותה לכל מתאמן או קבוצה בלחיצה."
            action={{ label: 'תוכנית חדשה', onClick: () => setBuilderOpen(true) }}
          />
        ) : (
          templates.map((tpl) => {
            const dayCount = tpl.days.length;
            const exerciseCount = tpl.days.reduce((sum, d) => sum + d.exercises.length, 0);
            return (
              <ListRow
                key={tpl.id}
                label={tpl.name}
                meta={`${dayCount} ימים · ${exerciseCount} תרגילים`}
                trailing={
                  <button
                    type="button"
                    onClick={() => setPendingDelete(tpl)}
                    aria-label={`מחיקת התוכנית ${tpl.name}`}
                    className="active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 44,
                      height: 44,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--fs-muted)',
                      cursor: 'pointer',
                      borderRadius: 4,
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                }
              />
            );
          })
        )}
      </Section>

      {/* How assignment works (the library itself never assigns) */}
      {!loading && templates.length > 0 && (
        <Section>
          <p
            className="flex items-start gap-2"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--fs-muted)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            <ClipboardList size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
            כדי לשייך תוכנית — היכנס למתאמן או לקבוצה ובחר "בניית תוכנית". תבנית שמורה נטענת משם
            בלחיצה.
          </p>
        </Section>
      )}

      <ProgramBuilder
        isOpen={builderOpen}
        onClose={() => {
          setBuilderOpen(false);
          reload();
        }}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        variant="danger"
        title="מחיקת תוכנית"
        description={`למחוק את התוכנית "${pendingDelete?.name ?? ''}" מהספרייה? פעולה זו אינה ניתנת לביטול.`}
        confirmLabel={deleting ? 'מוחק…' : 'מחיקה'}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </CoachPage>
  );
}
