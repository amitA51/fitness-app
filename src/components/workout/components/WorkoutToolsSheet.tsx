// WorkoutToolsSheet — the secondary-action drawer for the active-workout
// exercise surface. Pulls the occasional tools (plate calc, edit sets, drop-set
// legs, alternatives, superset) out of the always-on "כלים" panel so the live
// set surface stays focused on logging weight × reps + RPE. Built on the shared
// <Sheet> (drag handle, focus trap, safe-area); each row fires its action then
// dismisses. ExerciseDisplay owns the conditionals and passes only the tools
// that apply to the current set, so an empty sheet never opens.

import { type ReactNode, memo } from 'react';
import { useHapticFeedback } from '../../../hooks/useHapticFeedback';
import { Sheet } from '../../ui/Sheet';

export interface WorkoutTool {
  /** Stable key for the row. */
  id: string;
  /** Leading icon (18×18 recommended). */
  icon: ReactNode;
  /** Row title (Hebrew). */
  label: string;
  /** One-line description under the title. */
  caption?: string;
  /** Fired on tap, before the sheet closes. */
  onSelect: () => void;
  /** Accent-tinted row for a currently-active toggle (e.g. "בטל סופרסט"). */
  active?: boolean;
  /** Small accent dot on the icon (e.g. drop-set already has legs). */
  dot?: boolean;
}

interface WorkoutToolsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  tools: WorkoutTool[];
}

const WorkoutToolsSheet = memo<WorkoutToolsSheetProps>(
  ({ isOpen, onClose, exerciseName, tools }) => {
    const haptics = useHapticFeedback();

    return (
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title="כלים"
        ariaLabel={`כלים לתרגיל ${exerciseName}`}
      >
        <div className="space-y-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => {
                haptics.selection();
                tool.onSelect();
                onClose();
              }}
              className="w-full min-h-[56px] flex items-center gap-3 p-3 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fs-surface)]"
              style={{
                borderRadius: 'var(--radius-asymmetric)',
                textAlign: 'start',
                background: tool.active
                  ? 'color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))'
                  : 'var(--fs-surface-2)',
                border: tool.active
                  ? '1px solid color-mix(in srgb, var(--fs-accent) 40%, transparent)'
                  : '1px solid var(--color-border)',
              }}
            >
              {/* Icon bubble */}
              <span
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  borderRadius: 10,
                  background: 'color-mix(in srgb, var(--fs-accent) 12%, transparent)',
                  color: 'var(--fs-accent-2)',
                }}
              >
                {tool.icon}
                {tool.dot && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 2,
                      insetInlineEnd: 2,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--fs-accent)',
                      border: '1.5px solid var(--fs-surface)',
                    }}
                  />
                )}
              </span>

              {/* Label + caption */}
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--fs-ink)',
                  }}
                >
                  {tool.label}
                </span>
                {tool.caption && (
                  <span style={{ fontSize: 12, color: 'var(--fs-muted)', lineHeight: 1.3 }}>
                    {tool.caption}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    );
  }
);

WorkoutToolsSheet.displayName = 'WorkoutToolsSheet';

export default WorkoutToolsSheet;
