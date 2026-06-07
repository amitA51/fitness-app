// Fresh Steel / Obsidian design system — assignment-creation box (note + nutrition-target form)

import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { showToast } from '../../../components/ui/GlobalToast';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { createAssignment } from '../../../services/coach';
import { Section } from '../_shared';

export function AssignBox({ clientId }: { clientId: string }) {
  const [note, setNote] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState(false);

  const sendNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await createAssignment({
        kind: 'note',
        title: 'המלצה',
        payload: { text: note.trim() },
        clientId,
      });
      setNote('');
      showToast('ההמלצה נשלחה', 'success');
    } catch {
      showToast('השליחה נכשלה', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sendTarget = async () => {
    const kcal = Number(calories);
    if (!kcal) return;
    setBusy(true);
    try {
      const payload: Record<string, number> = { calories: kcal };
      const p = Number(protein);
      const c = Number(carbs);
      const f = Number(fat);
      if (p > 0) payload.protein = p;
      if (c > 0) payload.carbs = c;
      if (f > 0) payload.fat = f;
      await createAssignment({
        kind: 'nutrition_target',
        title: 'יעד תזונה',
        payload,
        clientId,
      });
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      showToast('יעד התזונה שויך', 'success');
    } catch {
      showToast('השליחה נכשלה', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="שיוך והמלצות">
      <div className="mb-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="כתוב המלצה למתאמן…"
          rows={2}
          aria-label="המלצה למתאמן"
        />
      </div>
      <Button variant="primary" fullWidth isLoading={busy} onClick={sendNote}>
        שלח המלצה
      </Button>
      <div className="mt-3">
        <div className="flex gap-2 items-end mb-2">
          <div className="flex-1">
            <label
              htmlFor="assign-calories"
              style={{
                display: 'block',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--fs-muted)',
                marginBottom: 4,
              }}
            >
              קלוריות
            </label>
            <Input
              id="assign-calories"
              type="number"
              inputMode="numeric"
              dir="ltr"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="קק&quot;ל"
              aria-label="יעד קלוריות"
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor="assign-protein"
              style={{
                display: 'block',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--fs-muted)',
                marginBottom: 4,
              }}
            >
              חלבון (ג׳)
            </label>
            <Input
              id="assign-protein"
              type="number"
              inputMode="numeric"
              dir="ltr"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              placeholder="ג׳"
              aria-label="יעד חלבון בגרמים"
            />
          </div>
        </div>
        <div className="flex gap-2 items-end mb-2">
          <div className="flex-1">
            <label
              htmlFor="assign-carbs"
              style={{
                display: 'block',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--fs-muted)',
                marginBottom: 4,
              }}
            >
              פחמימות (ג׳)
            </label>
            <Input
              id="assign-carbs"
              type="number"
              inputMode="numeric"
              dir="ltr"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              placeholder="ג׳"
              aria-label="יעד פחמימות בגרמים"
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor="assign-fat"
              style={{
                display: 'block',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--fs-muted)',
                marginBottom: 4,
              }}
            >
              שומן (ג׳)
            </label>
            <Input
              id="assign-fat"
              type="number"
              inputMode="numeric"
              dir="ltr"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              placeholder="ג׳"
              aria-label="יעד שומן בגרמים"
            />
          </div>
        </div>
        <Button variant="secondary" fullWidth isLoading={busy} onClick={sendTarget}>
          שייך יעד תזונה
        </Button>
      </div>
    </Section>
  );
}
