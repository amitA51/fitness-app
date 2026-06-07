// ============================================================================
// TodaysWorkoutCard — trainee Dashboard card for the coach-scheduled day
// Fresh Steel / Obsidian design system
// ============================================================================
// Surfaces today's coach-scheduled workouts. Invisible for guests and when the
// trainee has nothing scheduled today (renders null), so it never adds noise to
// a self-guided user's home. Reflects coach edits live via the workout_schedule
// realtime channel. Errors are swallowed (render null) — the Dashboard must not
// break if this online-only surface fails.

import { Check, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncTemplatesFromCloud } from '../../hooks/useCloudTemplateReflection';
import { subscribeToUserTable } from '../../services/coach/realtime';
import {
  type ScheduledWorkout,
  getTodaysScheduledWorkouts,
  markScheduleStatus,
} from '../../services/coach/scheduleService';
import { getCurrentUser } from '../../services/supabaseAuth';
import { logger } from '../../utils/logger';
import { Button } from '../ui/Button';
import { SkeletonBox } from '../ui/SkeletonLoader';

const CARD_RADIUS = '22px 16px 22px 16px';

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="האימון של היום"
      style={{
        marginTop: 20,
        background: 'var(--fs-surface)',
        borderRadius: CARD_RADIUS,
        border: '1px solid var(--fs-surface-2)',
        padding: 20,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          lineHeight: 1.2,
          color: 'var(--fs-ink)',
          margin: '0 0 12px',
        }}
      >
        האימון של היום
      </h2>
      {children}
    </section>
  );
}

function CardSkeleton() {
  return (
    <CardShell>
      <div role="status" aria-busy="true" aria-label="טוען את אימון היום" className="space-y-2">
        <SkeletonBox height={56} width="100%" borderRadius="md" />
      </div>
    </CardShell>
  );
}

interface RowProps {
  item: ScheduledWorkout;
  onStart: (item: ScheduledWorkout) => void;
  onSkip: (item: ScheduledWorkout) => void;
  isBusy: boolean;
}

function ScheduledRow({ item, onStart, onSkip, isBusy }: RowProps) {
  const isDone = item.status === 'done';
  const isSkipped = item.status === 'skipped';
  const title = item.title?.trim() || 'אימון';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: 'var(--fs-bg)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 8,
        opacity: isSkipped ? 0.6 : 1,
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--fs-ink)',
          }}
        >
          <bdi>{title}</bdi>
        </div>
        {(isDone || isSkipped) && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}>
            {isDone ? 'בוצע' : 'דולג'}
          </div>
        )}
      </div>

      {isDone ? (
        <span
          aria-label="האימון בוצע"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--fs-accent)',
            color: 'var(--color-ink-on-accent)',
            flexShrink: 0,
          }}
        >
          <Check size={18} aria-hidden="true" />
        </span>
      ) : isSkipped ? null : (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSkip(item)}
            disabled={isBusy}
            aria-label={`דילוג על ${title}`}
          >
            דילוג
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Play size={14} aria-hidden="true" />}
            isLoading={isBusy}
            onClick={() => onStart(item)}
            aria-label={`התחל ${title}`}
          >
            התחל אימון
          </Button>
        </div>
      )}
    </div>
  );
}

export function TodaysWorkoutCard() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ScheduledWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const rows = await getTodaysScheduledWorkouts();
      if (!mountedRef.current) return;
      setItems(rows);
      setFailed(false);
    } catch (e) {
      if (!mountedRef.current) return;
      setFailed(true);
      logger.db.warn('TodaysWorkoutCard load failed (non-fatal)', e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!mountedRef.current) return;
        if (!user) {
          setUserId(null);
          setLoading(false);
          return;
        }
        setUserId(user.id);
        await load();
      } catch (e) {
        if (!mountedRef.current) return;
        setFailed(true);
        setLoading(false);
        logger.db.warn('TodaysWorkoutCard init failed (non-fatal)', e);
        return;
      }
      // Realtime is a live-update enhancement only — it must NEVER blank the
      // card if the initial load already succeeded. subscribeToUserTable is
      // itself non-throwing, but keep this isolated as defense in depth.
      if (!mountedRef.current) return;
      try {
        const uid = await getCurrentUser();
        if (mountedRef.current && uid) {
          unsubscribe = subscribeToUserTable('workout_schedule', uid.id, () => void load());
        }
      } catch {
        /* live updates unavailable — the loaded data still renders */
      }
    })();

    return () => {
      mountedRef.current = false;
      unsubscribe?.();
    };
  }, [load]);

  const handleStart = useCallback(
    async (item: ScheduledWorkout) => {
      if (!item.templateId) return;
      setBusyId(item.id);
      try {
        await syncTemplatesFromCloud();
        navigate(`/workout/${item.templateId}`);
      } catch (e) {
        if (mountedRef.current) setBusyId(null);
        logger.workout.warn('Failed to start scheduled workout', e);
      }
    },
    [navigate]
  );

  const handleSkip = useCallback(
    async (item: ScheduledWorkout) => {
      setBusyId(item.id);
      try {
        await markScheduleStatus(item.id, 'skipped');
        await load();
      } catch (e) {
        logger.db.warn('Failed to skip scheduled workout', e);
      } finally {
        if (mountedRef.current) setBusyId(null);
      }
    },
    [load]
  );

  // Invisible for guests and on error — never break the Dashboard.
  if (!userId || failed) return null;
  if (loading) return <CardSkeleton />;
  // Nothing scheduled today: stay invisible for self-guided users.
  if (items.length === 0) return null;

  return (
    <CardShell>
      {items.map((item) => (
        <ScheduledRow
          key={item.id}
          item={item}
          onStart={handleStart}
          onSkip={handleSkip}
          isBusy={busyId === item.id}
        />
      ))}
    </CardShell>
  );
}

export default TodaysWorkoutCard;
