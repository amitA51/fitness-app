// ============================================================================
// COACH — edit/create a trainee daily nutrition log (Fresh Steel / Obsidian)
// ============================================================================
// Standalone bottom sheet for the coach to log or correct a day's macro totals
// on the trainee's behalf. Writes go through the audited coach writer
// (upsertClientNutritionLog) and reflect to the trainee. Labels ABOVE inputs,
// inline error below, numbers dir="ltr".

import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { showToast } from '../../../components/ui/GlobalToast';
import { Input } from '../../../components/ui/Input';
import { Sheet } from '../../../components/ui/Sheet';
import { Textarea } from '../../../components/ui/Textarea';
import { upsertClientNutritionLog } from '../../../services/coach';
import { todayStr } from '../../../utils/dateUtils';

export interface EditNutritionInitial {
  id?: string;
  date?: string;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  notes?: string;
}

interface EditNutritionSheetProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pass an existing log to edit; omit to create a new one. */
  initial?: EditNutritionInitial;
}

const numStr = (v: number | null | undefined): string => (v != null && v > 0 ? String(v) : '');

/** Parse an optional macro input: '' → undefined, otherwise a non-negative number. */
const parseOptionalMacro = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function EditNutritionSheet({
  clientId,
  isOpen,
  onClose,
  onSaved,
  initial,
}: EditNutritionSheetProps) {
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [calories, setCalories] = useState(numStr(initial?.calories));
  const [protein, setProtein] = useState(numStr(initial?.protein));
  const [carbs, setCarbs] = useState(numStr(initial?.carbs));
  const [fat, setFat] = useState(numStr(initial?.fat));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDate(initial?.date ?? todayStr());
    setCalories(numStr(initial?.calories));
    setProtein(numStr(initial?.protein));
    setCarbs(numStr(initial?.carbs));
    setFat(numStr(initial?.fat));
    setNotes(initial?.notes ?? '');
    setError(null);
  }, [isOpen, initial]);

  const save = async () => {
    const kcal = Number(calories);
    if (!date) {
      setError('יש לבחור תאריך');
      return;
    }
    if (!Number.isFinite(kcal) || kcal <= 0) {
      setError('יש להזין כמות קלוריות תקינה');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await upsertClientNutritionLog(clientId, {
        ...(initial?.id ? { id: initial.id } : {}),
        date,
        calories: kcal,
        protein: parseOptionalMacro(protein),
        carbs: parseOptionalMacro(carbs),
        fat: parseOptionalMacro(fat),
        notes: notes.trim() || undefined,
      });
      if (res.error) {
        showToast('השמירה נכשלה', 'error');
        return;
      }
      showToast('יומן התזונה נשמר', 'success');
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
      title={initial?.id ? 'עריכת יומן תזונה' : 'הוספת יומן תזונה'}
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
          label="קלוריות"
          type="number"
          inputMode="numeric"
          dir="ltr"
          unit="קק&quot;ל"
          value={calories}
          error={error ?? undefined}
          onChange={(e) => setCalories(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            label="חלבון"
            type="number"
            inputMode="numeric"
            dir="ltr"
            unit="ג׳"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
          <Input
            label="פחמימות"
            type="number"
            inputMode="numeric"
            dir="ltr"
            unit="ג׳"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
          <Input
            label="שומן"
            type="number"
            inputMode="numeric"
            dir="ltr"
            unit="ג׳"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
        </div>
        <Textarea
          label="הערה"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          aria-label="הערה ליומן התזונה"
          placeholder="לא חובה"
        />
      </div>
    </Sheet>
  );
}

export default EditNutritionSheet;
