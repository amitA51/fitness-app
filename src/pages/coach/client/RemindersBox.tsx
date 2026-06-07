// Fresh Steel / Obsidian design system — coach reminders box
// Coach creates / deletes reminders for a specific client.

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { showToast } from '../../../components/ui/GlobalToast';
import { Input } from '../../../components/ui/Input';
import {
  createReminder,
  deleteReminder,
  listCoachReminders,
} from '../../../services/coach/reminderService';
import type { Reminder } from '../../../types/coach';
import {
  InlineEmpty,
  ListRow,
  ListSkeleton,
  Section,
  SectionError,
  useAsyncData,
} from '../_shared';

// Hebrew short weekday names matching JS getDay() indices (0=Sun … 6=Sat)
const WEEKDAY_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const;
const WEEKDAY_FULL_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

function scheduleLabel(schedule: Reminder['schedule']): string {
  const parts: string[] = [];
  if (schedule.time) parts.push(schedule.time);
  if (schedule.date) parts.push(schedule.date);
  if (schedule.days && schedule.days.length > 0) {
    parts.push(schedule.days.map((d) => WEEKDAY_HE[d] ?? String(d)).join(' '));
  }
  return parts.join(' · ') || '—';
}

interface DayChipProps {
  day: number;
  selected: boolean;
  onToggle: (day: number) => void;
}

function DayChip({ day, selected, onToggle }: DayChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`יום ${WEEKDAY_FULL_HE[day]}`}
      onClick={() => onToggle(day)}
      style={{
        minWidth: 36,
        minHeight: 36,
        padding: '0 6px',
        fontSize: 13,
        fontFamily: 'var(--font-body)',
        fontWeight: selected ? 700 : 400,
        border: `2px solid ${selected ? 'var(--fs-accent)' : 'var(--fs-surface-2)'}`,
        background: selected ? 'var(--fs-primary)' : 'var(--fs-surface)',
        color: selected ? 'var(--fs-accent)' : 'var(--fs-muted)',
        cursor: 'pointer',
        transition: 'background 120ms, border-color 120ms, color 120ms',
      }}
    >
      {WEEKDAY_HE[day]}
    </button>
  );
}

interface DeleteConfirmState {
  open: boolean;
  id: string;
}

export function RemindersBox({ clientId }: { clientId: string }) {
  const {
    data: reminders,
    loading,
    error,
    reload,
  } = useAsyncData(() => listCoachReminders(clientId), [] as Reminder[]);

  // Form state
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Delete confirm dialog
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({ open: false, id: '' });

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError('נא להזין כותרת לתזכורת');
      return;
    }
    if (!time) {
      setFormError('נא לבחור שעה לתזכורת');
      return;
    }
    setBusy(true);
    try {
      const schedule = {
        time,
        ...(selectedDays.length > 0 ? { days: selectedDays } : {}),
      };
      await createReminder({ title: title.trim(), schedule, clientId });
      setTitle('');
      setTime('');
      setSelectedDays([]);
      showToast('התזכורת נשמרה', 'success');
      reload();
    } catch {
      showToast('שמירת התזכורת נכשלה', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const { id } = deleteConfirm;
    setDeleteConfirm({ open: false, id: '' });
    const { error: err } = await deleteReminder(id);
    if (err) {
      showToast('המחיקה נכשלה', 'error');
      return;
    }
    reload();
  };

  return (
    <Section title="תזכורות">
      {/* List */}
      {loading ? (
        <ListSkeleton rows={2} />
      ) : error ? (
        <SectionError onRetry={reload} />
      ) : reminders.length === 0 ? (
        <InlineEmpty>אין תזכורות עדיין</InlineEmpty>
      ) : (
        reminders.map((r) => (
          <ListRow
            key={r.id}
            label={r.title}
            meta={scheduleLabel(r.schedule)}
            trailing={
              <button
                type="button"
                aria-label="מחיקת תזכורת"
                onClick={() => setDeleteConfirm({ open: true, id: r.id })}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-error)',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            }
          />
        ))
      )}

      {/* Create form */}
      <form onSubmit={handleSubmit} noValidate style={{ marginTop: 12 }}>
        <div className="mb-3">
          <label
            htmlFor="reminder-title"
            style={{
              display: 'block',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--fs-muted)',
              marginBottom: 4,
            }}
          >
            כותרת תזכורת
          </label>
          <Input
            id="reminder-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="לדוגמה: שתה מים"
            aria-required="true"
          />
        </div>

        <div className="mb-3">
          <label
            htmlFor="reminder-time"
            style={{
              display: 'block',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--fs-muted)',
              marginBottom: 4,
            }}
          >
            שעה
          </label>
          <input
            id="reminder-time"
            type="time"
            dir="ltr"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-required="true"
            style={{
              width: '100%',
              minHeight: 44,
              padding: '0 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              color: 'var(--fs-ink)',
              outline: 'none',
            }}
          />
        </div>

        <div className="mb-3">
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--fs-muted)',
              marginBottom: 6,
            }}
          >
            ימים (אופציונלי — ריק = כל יום)
          </p>
          <div className="flex gap-1 flex-wrap">
            {([0, 1, 2, 3, 4, 5, 6] as const).map((day) => (
              <DayChip
                key={day}
                day={day}
                selected={selectedDays.includes(day)}
                onToggle={toggleDay}
              />
            ))}
          </div>
        </div>

        {formError && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--color-error)',
              marginBottom: 8,
            }}
          >
            {formError}
          </p>
        )}

        <Button type="submit" variant="secondary" fullWidth isLoading={busy}>
          הוסף תזכורת
        </Button>
      </form>

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        variant="warning"
        title="מחיקת תזכורת"
        description="התזכורת תוסר מהמתאמן."
        confirmLabel="מחק"
        cancelLabel="חזרה"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: '' })}
      />
    </Section>
  );
}
