// ============================================================================
// COACH — edit/create a trainee body-weight entry (Fresh Steel / Obsidian)
// ============================================================================
// Standalone bottom sheet the coach opens from ClientDetail to log or correct a
// weigh-in on the trainee's behalf. Writes go through the audited coach writer
// (upsertClientBodyWeight) and reflect to the trainee via their pull/Realtime
// path. Labels sit ABOVE inputs (global Input), errors render inline below the
// field, numbers are dir="ltr" inside the RTL layout.

import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { showToast } from '../../../components/ui/GlobalToast';
import { Input } from '../../../components/ui/Input';
import { Sheet } from '../../../components/ui/Sheet';
import { Textarea } from '../../../components/ui/Textarea';
import { upsertClientBodyWeight } from '../../../services/coach';
import { todayStr } from '../../../utils/dateUtils';

export interface EditBodyWeightInitial {
  id?: string;
  date?: string;
  weight?: number;
  notes?: string;
}

interface EditBodyWeightSheetProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pass an existing entry to edit; omit to create a new one. */
  initial?: EditBodyWeightInitial;
}

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;

export function EditBodyWeightSheet({
  clientId,
  isOpen,
  onClose,
  onSaved,
  initial,
}: EditBodyWeightSheetProps) {
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [weight, setWeight] = useState(initial?.weight != null ? String(initial.weight) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-seed the form whenever a different entry (or a fresh create) is opened.
  useEffect(() => {
    if (!isOpen) return;
    setDate(initial?.date ?? todayStr());
    setWeight(initial?.weight != null ? String(initial.weight) : '');
    setNotes(initial?.notes ?? '');
    setError(null);
  }, [isOpen, initial]);

  const save = async () => {
    const w = Number(weight);
    if (!date) {
      setError('יש לבחור תאריך');
      return;
    }
    if (!Number.isFinite(w) || w < MIN_WEIGHT_KG || w > MAX_WEIGHT_KG) {
      setError(`משקל לא תקין (${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} ק"ג)`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await upsertClientBodyWeight(clientId, {
        ...(initial?.id ? { id: initial.id } : {}),
        date,
        weight: w,
        notes: notes.trim() || undefined,
      });
      if (res.error) {
        showToast('השמירה נכשלה', 'error');
        return;
      }
      showToast('המשקל נשמר', 'success');
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={initial?.id ? 'עריכת משקל' : 'הוספת משקל'}
      footer={
        <Button variant="primary" fullWidth isLoading={busy} onClick={save}>
          שמירה
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="תאריך"
          type="date"
          dir="ltr"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          label="משקל"
          type="number"
          inputMode="decimal"
          dir="ltr"
          unit='ק"ג'
          step="0.1"
          value={weight}
          error={error ?? undefined}
          onChange={(e) => setWeight(e.target.value)}
        />
        <Textarea
          label="הערה"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          aria-label="הערה למשקל"
          placeholder="לא חובה"
        />
      </div>
    </Sheet>
  );
}

export default EditBodyWeightSheet;
