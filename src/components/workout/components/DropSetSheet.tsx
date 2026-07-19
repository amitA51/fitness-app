// DropSetSheet — log each weight×reps leg within a SINGLE set. For drop sets or
// any set where the load changes mid-set (e.g. 60×8 → 50×6 → 40×4 as one set).
// Built on the foundation <Sheet>. Editing is fully local; the legs are only
// committed to the reducer (UPDATE_SET_SEGMENTS) on "שמור".

import { Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import type { SetSegment, WorkoutSet } from '../../../types';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';

interface DropSetSheetProps {
  isOpen: boolean;
  set: WorkoutSet;
  setIndex: number;
  exerciseName: string;
  weightIncrement: number;
  onSave: (segments: SetSegment[]) => void;
  onClose: () => void;
}

const stepBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  minWidth: 40,
  minHeight: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--fs-surface)',
  border: '1px solid var(--fs-steel)',
  borderRadius: 10,
  cursor: 'pointer',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 18,
  color: 'var(--fs-ink)',
};

const numberInput: React.CSSProperties = {
  flex: 1,
  height: 40,
  minWidth: 0,
  background: 'var(--fs-surface)',
  border: '1px solid var(--fs-steel)',
  borderRadius: 10,
  textAlign: 'center',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 17,
  color: 'var(--fs-heading)',
  outline: 'none',
};

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '-0.01em',
  color: 'var(--fs-muted)',
  marginBottom: 4,
};

const DropSetSheet = memo<DropSetSheetProps>(
  ({ isOpen, set, setIndex, exerciseName, weightIncrement, onSave, onClose }) => {
    const [segments, setSegments] = useState<SetSegment[]>([]);

    // Seed on open: use existing legs, else derive a first leg from the set's
    // current weight/reps so the user starts from what they already entered.
    useEffect(() => {
      if (!isOpen) return;
      if (set.segments && set.segments.length > 0) {
        setSegments(set.segments.map((s) => ({ ...s })));
      } else {
        setSegments([{ weight: set.weight || 0, reps: set.reps || 0 }]);
      }
    }, [isOpen, set.segments, set.weight, set.reps]);

    const updateLeg = useCallback((index: number, field: keyof SetSegment, value: number) => {
      setSegments((prev) =>
        prev.map((leg, i) => (i === index ? { ...leg, [field]: Math.max(0, value) } : leg))
      );
    }, []);

    const addLeg = useCallback(() => {
      setSegments((prev) => {
        const last = prev[prev.length - 1];
        // New legs of a drop set usually drop the weight — seed lighter.
        const nextWeight = last
          ? Math.max(0, Math.round((last.weight - weightIncrement * 2) * 100) / 100)
          : 0;
        return [...prev, { weight: nextWeight, reps: last?.reps ?? 0 }];
      });
    }, [weightIncrement]);

    const removeLeg = useCallback((index: number) => {
      setSegments((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleSave = useCallback(() => {
      // A single leg (or none) is just a plain set — clear segments so we don't
      // store a redundant one-leg array.
      const meaningful = segments.filter((s) => s.weight > 0 || s.reps > 0);
      onSave(meaningful.length > 1 ? meaningful : []);
      onClose();
    }, [segments, onSave, onClose]);

    const totalVolume = segments.reduce(
      (sum, s) => sum + (s.weight > 0 && s.reps > 0 ? s.weight * s.reps : 0),
      0
    );

    const footer = (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>
          ביטול
        </Button>
        <Button variant="primary" onClick={handleSave} style={{ flex: 1 }}>
          שמור
        </Button>
      </div>
    );

    return (
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title="מקטעי דרופ-סט"
        ariaLabel={`מקטעי דרופ-סט — סט ${setIndex + 1} ${exerciseName}`}
        footer={footer}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
            marginBottom: 12,
            textAlign: 'start',
          }}
        >
          {exerciseName} · סט {setIndex + 1}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {segments.map((leg, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: legs are an ordered editable list, index is the identity
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                padding: 12,
                background: 'var(--fs-surface)',
                border: '1px solid var(--fs-steel)',
                borderRadius: 14,
              }}
            >
              <span
                aria-hidden
                style={{
                  alignSelf: 'center',
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--fs-accent) 16%, var(--fs-surface))',
                  color: 'var(--fs-accent-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {index + 1}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={fieldLabel}>ק״ג</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="transition-transform active:scale-[0.94]"
                    style={stepBtn}
                    aria-label="הפחת משקל"
                    onClick={() =>
                      updateLeg(
                        index,
                        'weight',
                        Math.round((leg.weight - weightIncrement) * 100) / 100
                      )
                    }
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={leg.weight || 0}
                    onChange={(e) => updateLeg(index, 'weight', Number(e.target.value))}
                    style={numberInput}
                    aria-label={`משקל מקטע ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="transition-transform active:scale-[0.94]"
                    style={stepBtn}
                    aria-label="הגדל משקל"
                    onClick={() =>
                      updateLeg(
                        index,
                        'weight',
                        Math.round((leg.weight + weightIncrement) * 100) / 100
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={fieldLabel}>חזרות</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="transition-transform active:scale-[0.94]"
                    style={stepBtn}
                    aria-label="הפחת חזרות"
                    onClick={() => updateLeg(index, 'reps', leg.reps - 1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={leg.reps || 0}
                    onChange={(e) => updateLeg(index, 'reps', Number(e.target.value))}
                    style={numberInput}
                    aria-label={`חזרות מקטע ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="transition-transform active:scale-[0.94]"
                    style={stepBtn}
                    aria-label="הגדל חזרות"
                    onClick={() => updateLeg(index, 'reps', leg.reps + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              {segments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLeg(index)}
                  aria-label={`מחק מקטע ${index + 1}`}
                  style={{
                    ...stepBtn,
                    alignSelf: 'flex-end',
                    color: 'var(--color-error, #d9534f)',
                    borderColor: 'var(--fs-steel)',
                  }}
                >
                  <Trash2 size={16} strokeWidth={2.25} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addLeg}
          className="active:scale-[0.98]"
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            minHeight: 44,
            borderRadius: 12,
            background: 'transparent',
            border: '1px dashed color-mix(in srgb, var(--fs-accent) 45%, var(--fs-steel))',
            color: 'var(--fs-accent-2)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          הוסף מקטע
        </button>

        <div
          style={{
            marginTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            background: 'color-mix(in srgb, var(--fs-accent) 8%, var(--fs-surface))',
            border: '1px solid color-mix(in srgb, var(--fs-accent) 20%, transparent)',
            borderRadius: 12,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
            }}
          >
            נפח כולל
          </span>
          <span
            dir="ltr"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--fs-ink)',
            }}
          >
            {totalVolume.toLocaleString()} ק״ג
          </span>
        </div>
      </Sheet>
    );
  }
);

DropSetSheet.displayName = 'DropSetSheet';

export default DropSetSheet;
