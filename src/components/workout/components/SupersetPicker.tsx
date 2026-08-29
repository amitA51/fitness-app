// SupersetPicker — bottom sheet for building a superset / giant set.
//
// Opened from an exercise's "סופרסט" chip (the anchor). Lists every exercise in
// the current workout and lets the user multi-select which ones to group with
// the anchor. The anchor is always selected and cannot be deselected. Confirm
// dispatches a single CREATE_SUPERSET (2 = superset, 3+ = giant set).
//
// Built on <ModalOverlay variant="bottomSheet">, so the slide-in, the scrim and
// the drag-to-dismiss (1:1 downward tracking, rubber-band up, momentum
// projection on release) are all the house implementation.

import { Check, X as CloseIcon, Link2 } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { ModalOverlay } from '../../ui/ModalOverlay';
import type { SupersetGroup } from '../core/workoutTypes';

interface SupersetPickerExercise {
  id: string;
  name?: string;
}

interface SupersetPickerProps {
  isOpen: boolean;
  exercises: SupersetPickerExercise[];
  anchorExerciseId: string | null;
  existingGroups: SupersetGroup[];
  onConfirm: (exerciseIds: string[]) => void;
  onClose: () => void;
}

const SupersetPicker: React.FC<SupersetPickerProps> = ({
  isOpen,
  exercises,
  anchorExerciseId,
  existingGroups,
  onConfirm,
  onClose,
}) => {
  // Selected set seeded with the anchor; the anchor stays locked-in.
  const [selected, setSelected] = useState<Set<string>>(() =>
    anchorExerciseId ? new Set([anchorExerciseId]) : new Set()
  );

  // Re-seed whenever the anchor changes (picker reused across openings).
  const seededFor = useMemo(() => anchorExerciseId, [anchorExerciseId]);
  const [lastSeed, setLastSeed] = useState(seededFor);
  if (lastSeed !== seededFor) {
    setLastSeed(seededFor);
    setSelected(anchorExerciseId ? new Set([anchorExerciseId]) : new Set());
  }

  const toggle = useCallback(
    (id: string) => {
      if (id === anchorExerciseId) return; // anchor locked
      triggerHaptic('light');
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [anchorExerciseId]
  );

  const groupIdOf = useCallback(
    (exerciseId: string): string | null =>
      existingGroups.find((g) => g.exercises.includes(exerciseId))?.id ?? null,
    [existingGroups]
  );

  const handleConfirm = useCallback(() => {
    // Preserve workout order so the round-robin order is intuitive (top→bottom).
    const orderedIds = exercises.map((e) => e.id).filter((id) => selected.has(id));
    if (orderedIds.length < 2) return;
    onConfirm(orderedIds);
  }, [exercises, selected, onConfirm]);

  const selectedCount = selected.size;
  const canConfirm = selectedCount >= 2;

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      zLevel="extreme"
      backdropOpacity={60}
      blur="none"
      trapFocus
      lockScroll={false}
      closeOnBackdropClick
      closeOnEscape
      ariaLabel="בחירת תרגילים לסופרסט"
    >
      {/* Entry spring and drag-to-dismiss belong to ModalOverlay's bottomSheet
          variant. The hand-rolled version here had both drag constraints pinned
          at 0 with dragElastic 0.5, so the sheet moved half as far as the finger,
          and its dismiss test was a bare `offset.y > 150` with no velocity. */}
      <div className="w-full flex flex-col" style={{ maxHeight: '85dvh' }}>
        {/* Masthead — doubles as the drag handle (chrome; its close button is
            excluded from the grab by ModalOverlay's interactive-element guard) */}
        <div
          data-sheet-drag-handle
          style={{ background: 'var(--fs-primary)', touchAction: 'none' }}
        >
          <div className="flex justify-center pt-3 pb-2" style={{ cursor: 'grab' }}>
            <div className="w-10 h-1" style={{ background: 'var(--fs-surface)', opacity: 0.3 }} />
          </div>
          <div className="px-5 pb-4 flex items-center justify-between">
            <div>
              <h1
                className="flex items-center gap-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 24,
                  color: 'var(--color-ink-on-dark)',
                  lineHeight: 1,
                }}
              >
                <Link2 size={20} strokeWidth={2.5} />
                סופרסט
              </h1>
              <p
                className="mt-1"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '-0.01em',
                  color: 'var(--color-ink-on-dark)',
                  opacity: 0.5,
                }}
              >
                בחר תרגילים לקיבוץ
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center cursor-pointer"
              style={{ background: 'var(--fs-surface)', opacity: 0.1 }}
              aria-label="סגור"
            >
              <CloseIcon className="w-5 h-5" style={{ color: 'var(--color-ink-on-dark)' }} />
            </button>
          </div>
        </div>

        {/* Body — exercise list */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--fs-surface)', padding: '12px 14px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exercises.map((ex) => {
              const isSelected = selected.has(ex.id);
              const isAnchor = ex.id === anchorExerciseId;
              const inOtherGroup = !isAnchor && groupIdOf(ex.id) !== null;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => toggle(ex.id)}
                  disabled={isAnchor}
                  aria-pressed={isSelected}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    minHeight: 56,
                    textAlign: 'right',
                    borderRadius: 12,
                    cursor: isAnchor ? 'default' : 'pointer',
                    background: isSelected
                      ? 'color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))'
                      : 'var(--fs-surface)',
                    border: isSelected ? '2px solid var(--fs-accent)' : '1px solid var(--fs-steel)',
                    opacity: isAnchor ? 0.9 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      flexShrink: 0,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isSelected ? 'var(--fs-accent)' : 'transparent',
                      border: isSelected ? 'none' : '2px solid var(--fs-steel)',
                      color: 'var(--color-ink-on-accent)',
                    }}
                  >
                    {isSelected && <Check size={16} strokeWidth={3} />}
                  </div>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 16,
                      color: 'var(--fs-heading)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ex.name || 'תרגיל ללא שם'}
                  </span>
                  {isAnchor && (
                    <span
                      style={{
                        flexShrink: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        color: 'var(--fs-accent-2)',
                      }}
                    >
                      בסיס
                    </span>
                  )}
                  {inOtherGroup && (
                    <span
                      style={{
                        flexShrink: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        color: 'var(--fs-muted)',
                      }}
                    >
                      בקבוצה אחרת
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer CTAs */}
        <div
          className="px-5 py-4 flex flex-col gap-2"
          style={{ background: 'var(--fs-surface)', borderTop: '2px solid var(--fs-primary)' }}
        >
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full flex items-center justify-center gap-2 cursor-pointer"
            style={{
              background: canConfirm ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
              color: canConfirm ? 'var(--fs-accent)' : 'var(--fs-muted)',
              padding: '16px 24px',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: '-0.01em',
              minHeight: 52,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            <Link2 size={18} strokeWidth={2.5} />
            צור סופרסט ({selectedCount})
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full cursor-pointer"
            style={{
              background: 'transparent',
              color: 'var(--fs-muted)',
              border: '2px solid var(--fs-surface-2)',
              padding: '12px 24px',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '-0.01em',
              minHeight: 44,
            }}
          >
            ביטול
          </button>
        </div>

        <div
          style={{ height: 'env(safe-area-inset-bottom, 8px)', background: 'var(--fs-surface)' }}
        />
      </div>
    </ModalOverlay>
  );
};

export default SupersetPicker;
