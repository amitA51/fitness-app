// ============================================================================
// ReportReasonSheet — moderation report reason picker (Apple Guideline 1.2).
//
// Built on the canonical <Sheet>. Replaces the old fire-instantly report: the
// user first picks a reason chip (ספאם / תוכן פוגעני / הטרדה / אחר), and only
// then is the report filed by the parent. The parent owns the service call and
// the success / error toast — this component is presentation + selection only.
// FAIL-SAFE-INERT: never throws; closing or picking are the only exits.
// Fresh Steel / Obsidian design system. RTL Hebrew-first.
// ============================================================================

import { useCallback, useState } from 'react';
import { Sheet } from '../ui/Sheet';

// Stable reason set. `id` is the value persisted server-side (Hebrew is the
// label only) so reports stay queryable even if copy changes later.
const REASONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'spam', label: 'ספאם' },
  { id: 'offensive', label: 'תוכן פוגעני' },
  { id: 'harassment', label: 'הטרדה' },
  { id: 'other', label: 'אחר' },
];

interface ReportReasonSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fires once the user picks a reason. Parent files the report + toasts. */
  onPick: (reason: string) => Promise<void>;
}

export function ReportReasonSheet({ isOpen, onClose, onPick }: ReportReasonSheetProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handlePick = useCallback(
    async (reasonId: string) => {
      if (pendingId) return;
      setPendingId(reasonId);
      try {
        await onPick(reasonId);
        onClose();
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, onPick, onClose]
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="דיווח על תוכן">
      <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            lineHeight: 1.55,
            color: 'var(--fs-muted)',
          }}
        >
          בחרו את הסיבה לדיווח. הצוות יבדוק את התוכן בהתאם.
        </p>

        <ul
          aria-label="סיבות לדיווח"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {REASONS.map((reason) => {
            const isPending = pendingId === reason.id;
            const isDisabled = pendingId !== null && !isPending;
            return (
              <li key={reason.id}>
                <button
                  type="button"
                  onClick={() => handlePick(reason.id)}
                  disabled={pendingId !== null}
                  className="focus-ring active:scale-[0.98]"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 44,
                    padding: '10px 18px',
                    borderRadius: 999,
                    border: '1px solid var(--fs-surface-2)',
                    background: isPending ? 'var(--fs-accent)' : 'var(--fs-bg)',
                    color: isPending ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: pendingId !== null ? 'default' : 'pointer',
                    opacity: isDisabled ? 0.5 : 1,
                    transition: 'background 0.15s, color 0.15s, opacity 0.15s',
                  }}
                >
                  {isPending ? 'שולח…' : reason.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}

export default ReportReasonSheet;
