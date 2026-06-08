// ============================================================================
// ScheduleCalendar — per-client weekly planner for the coach
// Fresh Steel / Obsidian design system
// ============================================================================
// Shows a Sunday-first week of the client's scheduled workouts with next/prev
// navigation. Per day: a list of scheduled items + a "+" to add one from the
// client's templates. Tapping an item opens an action sheet (done / skipped /
// move / delete). Online-only (coach services); 4 UI states throughout.

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ExportCalendarButton } from '../../../components/calendar/ExportCalendarButton';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { showToast } from '../../../components/ui/GlobalToast';
import { Sheet } from '../../../components/ui/Sheet';
import { SkeletonBox } from '../../../components/ui/SkeletonLoader';
import { getClientTemplates } from '../../../services/coach/coachApi';
import {
  type ScheduledWorkout,
  deleteScheduledWorkout,
  getClientSchedule,
  scheduleWorkout,
  updateScheduledWorkout,
} from '../../../services/coach/scheduleService';
import type { WorkoutTemplate } from '../../../types';
import type { IcsEvent } from '../../../utils/icsExport';
import { SectionError, useAsyncData } from '../_shared';

// 0 = Sunday … 6 = Saturday
const WEEKDAY_LABEL: Record<number, string> = {
  0: 'ראשון',
  1: 'שני',
  2: 'שלישי',
  3: 'רביעי',
  4: 'חמישי',
  5: 'שישי',
  6: 'שבת',
};

const STATUS_META: Record<ScheduledWorkout['status'], { label: string; color: string }> = {
  planned: { label: 'מתוכנן', color: 'var(--fs-muted)' },
  done: { label: 'בוצע', color: 'var(--fs-accent)' },
  skipped: { label: 'דולג', color: 'var(--fs-warn)' },
};

// ---- date helpers (Sunday-first, local time) -------------------------------

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Sunday of the week containing `d` (local time). */
function sundayOf(d: Date): Date {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - t.getDay());
  return t;
}

function addDaysDate(d: Date, days: number): Date {
  const t = new Date(d);
  t.setDate(t.getDate() + days);
  return t;
}

interface WeekDay {
  date: string;
  weekday: number;
  isToday: boolean;
}

function buildWeek(weekStart: Date, todayStr: string): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDaysDate(weekStart, i);
    const date = toLocalDateString(d);
    return { date, weekday: d.getDay(), isToday: date === todayStr };
  });
}

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

// ---- subcomponents ----------------------------------------------------------

function StatusChip({ status }: { status: ScheduledWorkout['status'] }) {
  const meta = STATUS_META[status];
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.06em',
        color: meta.color,
        border: `1px solid ${meta.color}`,
        borderRadius: 999,
        padding: '1px 7px',
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  );
}

function CalendarSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="טוען יומן" className="space-y-2">
      {Array.from({ length: 7 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7 placeholder rows
        <SkeletonBox key={i} height={64} width="100%" />
      ))}
    </div>
  );
}

interface DayCardProps {
  day: WeekDay;
  items: ScheduledWorkout[];
  onAdd: (date: string) => void;
  onOpenItem: (item: ScheduledWorkout) => void;
}

function DayCard({ day, items, onAdd, onOpenItem }: DayCardProps) {
  return (
    <div
      style={{
        background: 'var(--fs-surface)',
        border: `1px solid ${day.isToday ? 'var(--fs-accent)' : 'var(--fs-surface-2)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        marginBottom: 8,
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: items.length ? 8 : 0 }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--fs-ink)',
          }}
        >
          {WEEKDAY_LABEL[day.weekday]}{' '}
          <span dir="ltr" style={{ color: 'var(--fs-muted)', fontFamily: 'var(--font-mono)' }}>
            {shortDate(day.date)}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onAdd(day.date)}
          aria-label={`הוספת אימון ל${WEEKDAY_LABEL[day.weekday]}`}
          className="inline-flex items-center justify-center active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--fs-surface-2)',
            background: 'var(--fs-bg)',
            color: 'var(--fs-accent)',
          }}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpenItem(item)}
          className="w-full flex items-center gap-2 text-right active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
          style={{
            background: 'var(--fs-bg)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 10px',
            marginTop: 6,
            minHeight: 40,
          }}
        >
          <span
            className="flex-1 min-w-0"
            style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--fs-ink)' }}
          >
            <bdi>{item.title?.trim() || 'אימון'}</bdi>
          </span>
          <StatusChip status={item.status} />
        </button>
      ))}
    </div>
  );
}

// ---- template picker sheet --------------------------------------------------

function TemplatePickerSheet({
  isOpen,
  onClose,
  clientId,
  onPick,
}: {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  onPick: (template: WorkoutTemplate) => void;
}) {
  const {
    data: templates,
    loading,
    error,
    reload,
  } = useAsyncData<WorkoutTemplate[]>(
    () => (isOpen ? getClientTemplates(clientId) : Promise.resolve([])),
    []
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="בחירת אימון לתוכנית">
      {loading ? (
        <div role="status" aria-busy="true" aria-label="טוען תבניות" className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
            <SkeletonBox key={i} height={48} width="100%" />
          ))}
        </div>
      ) : error ? (
        <SectionError onRetry={reload} />
      ) : templates.length === 0 ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-muted)',
            textAlign: 'center',
            padding: '20px 16px',
          }}
        >
          למתאמן עדיין אין תבניות אימון. צרו תבנית ושייכו אותה לפני קביעת מועד.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className="w-full text-right active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
              style={{
                background: 'var(--fs-surface)',
                border: '1px solid var(--fs-surface-2)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                minHeight: 44,
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--fs-ink)',
              }}
            >
              <bdi>{t.name}</bdi>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

// ---- item action sheet ------------------------------------------------------

function ActionButton({
  label,
  onClick,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-right active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        marginBottom: 8,
        minHeight: 44,
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 600,
        color: tone === 'danger' ? 'var(--color-error)' : 'var(--fs-ink)',
      }}
    >
      {label}
    </button>
  );
}

function ItemActionSheet({
  item,
  onClose,
  onStatus,
  onMove,
  onDelete,
}: {
  item: ScheduledWorkout;
  onClose: () => void;
  onStatus: (status: ScheduledWorkout['status']) => void;
  onMove: (deltaDays: number) => void;
  onDelete: () => void;
}) {
  return (
    <Sheet isOpen onClose={onClose} title={item.title?.trim() || 'אימון מתוכנן'}>
      <ActionButton label="סימון כבוצע" onClick={() => onStatus('done')} />
      <ActionButton label="סימון כדולג" onClick={() => onStatus('skipped')} />
      {item.status !== 'planned' && (
        <ActionButton label="החזרה למתוכנן" onClick={() => onStatus('planned')} />
      )}
      <div className="flex gap-2" style={{ marginBottom: 8 }}>
        <ActionButton label="הקדמה ביום" onClick={() => onMove(-1)} />
        <ActionButton label="דחייה ביום" onClick={() => onMove(1)} />
      </div>
      <ActionButton label="מחיקה" tone="danger" onClick={onDelete} />
    </Sheet>
  );
}

// ---- main component ---------------------------------------------------------

export function ScheduleCalendar({ clientId }: { clientId: string }) {
  const todayStr = useMemo(() => toLocalDateString(new Date()), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [addDate, setAddDate] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ScheduledWorkout | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduledWorkout | null>(null);

  const weekStart = useMemo(() => {
    const base = sundayOf(new Date());
    return addDaysDate(base, weekOffset * 7);
  }, [weekOffset]);

  const fromDate = useMemo(() => toLocalDateString(weekStart), [weekStart]);
  const toDate = useMemo(() => toLocalDateString(addDaysDate(weekStart, 6)), [weekStart]);
  const week = useMemo(() => buildWeek(weekStart, todayStr), [weekStart, todayStr]);

  const {
    data: schedule,
    loading,
    error,
    reload,
  } = useAsyncData<ScheduledWorkout[]>(() => getClientSchedule(clientId, fromDate, toDate), []);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ScheduledWorkout[]>();
    for (const item of schedule) {
      const bucket = map.get(item.scheduledDate);
      if (bucket) bucket.push(item);
      else map.set(item.scheduledDate, [item]);
    }
    return map;
  }, [schedule]);

  const icsEvents = useMemo<IcsEvent[]>(
    () =>
      schedule.map((w) => ({
        uid: w.id,
        title: w.title?.trim() || 'אימון מתוכנן',
        start: `${w.scheduledDate}T08:00:00`,
      })),
    [schedule]
  );

  const handlePick = useCallback(
    async (template: WorkoutTemplate) => {
      if (!addDate) return;
      const date = addDate;
      setAddDate(null);
      const { error: err } = await scheduleWorkout(clientId, {
        templateId: template.id,
        scheduledDate: date,
        title: template.name,
      });
      if (err) showToast('לא ניתן לשבץ את האימון', 'error');
      else showToast('האימון שובץ ליומן');
      reload();
    },
    [addDate, clientId, reload]
  );

  const handleStatus = useCallback(
    async (status: ScheduledWorkout['status']) => {
      const item = activeItem;
      if (!item) return;
      setActiveItem(null);
      const { error: err } = await updateScheduledWorkout(item.id, { status });
      if (err) showToast('לא ניתן לעדכן את האימון', 'error');
      reload();
    },
    [activeItem, reload]
  );

  const handleMove = useCallback(
    async (deltaDays: number) => {
      const item = activeItem;
      if (!item) return;
      setActiveItem(null);
      const moved = toLocalDateString(
        addDaysDate(new Date(`${item.scheduledDate}T00:00:00`), deltaDays)
      );
      const { error: err } = await updateScheduledWorkout(item.id, { scheduledDate: moved });
      if (err) showToast('לא ניתן להעביר את האימון', 'error');
      reload();
    },
    [activeItem, reload]
  );

  const handleDelete = useCallback(async () => {
    const item = pendingDelete;
    if (!item) return;
    setPendingDelete(null);
    const { error: err } = await deleteScheduledWorkout(item.id);
    if (err) showToast('לא ניתן למחוק את האימון', 'error');
    reload();
  }, [pendingDelete, reload]);

  return (
    <div dir="rtl">
      {/* Week navigation */}
      <div className="flex flex-col gap-2" style={{ marginBottom: 12 }}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            aria-label="שבוע קודם"
            className="inline-flex items-center justify-center active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
            style={{ width: 44, height: 44, color: 'var(--fs-ink)' }}
          >
            {/* RTL: "previous" points toward the inline-start (right edge) */}
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--fs-muted)',
              letterSpacing: '0.04em',
            }}
          >
            <bdi dir="ltr">
              {shortDate(fromDate)} – {shortDate(toDate)}
            </bdi>
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            aria-label="שבוע הבא"
            className="inline-flex items-center justify-center active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
            style={{ width: 44, height: 44, color: 'var(--fs-ink)' }}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
        </div>
        {/* Export CTA — disabled when schedule is empty or still loading */}
        {!loading && !error && (
          <div className="flex justify-start">
            <ExportCalendarButton
              events={icsEvents}
              filename={`sparkos-schedule-${fromDate}`}
              label="ייצוא שבוע ליומן"
            />
          </div>
        )}
      </div>

      {/* Body — 4 UI states */}
      {loading ? (
        <CalendarSkeleton />
      ) : error ? (
        <SectionError onRetry={reload} />
      ) : (
        week.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            items={itemsByDate.get(day.date) ?? []}
            onAdd={setAddDate}
            onOpenItem={setActiveItem}
          />
        ))
      )}

      {/* Add-from-templates sheet */}
      <TemplatePickerSheet
        isOpen={addDate !== null}
        onClose={() => setAddDate(null)}
        clientId={clientId}
        onPick={handlePick}
      />

      {/* Item action sheet */}
      {activeItem && (
        <ItemActionSheet
          item={activeItem}
          onClose={() => setActiveItem(null)}
          onStatus={handleStatus}
          onMove={handleMove}
          onDelete={() => {
            setPendingDelete(activeItem);
            setActiveItem(null);
          }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        variant="danger"
        title="מחיקת אימון מהיומן"
        description="האימון יוסר מהיומן של המתאמן. אפשר לשבץ אותו מחדש בכל עת."
        confirmLabel="מחיקה"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default ScheduleCalendar;
