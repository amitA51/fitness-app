// ============================================================================
// CardioLogPage (/cardio/log?activity=run) — log an effort done earlier.
// ============================================================================
// Saves an ordinary completed WorkoutSession (see utils/cardio/session), so the
// calendar, streak, week count, history, sync and the coach all see it at once,
// then opens the session's detail screen as the "done" moment.

import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { useData } from '../../contexts/DataContext';
import { readLastActivity, rememberLastActivity } from '../../services/running/cardioPrefs';
import { saveWorkoutSession } from '../../services/sessionDb';
import type { CardioActivity } from '../../types';
import { buildCardioSession, cardioActivityConfig, isCardioActivity } from '../../utils/cardio';
import { logger } from '../../utils/logger';
import { CardioEntryForm, type CardioFormValues } from './components/CardioEntryForm';
import { useBodyWeightKg } from './useBodyWeightKg';
import './cardio.css';

export default function CardioLogPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refreshData } = useData();
  const weightKg = useBodyWeightKg();

  const fromQuery = params.get('activity');
  const [activity, setActivity] = useState<CardioActivity>(() =>
    isCardioActivity(fromQuery) ? fromQuery : readLastActivity()
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const changeActivity = useCallback((next: CardioActivity) => {
    setActivity(next);
    rememberLastActivity(next);
  }, []);

  const goBack = useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (idx && idx > 0) navigate(-1);
    else navigate('/cardio');
  }, [navigate]);

  const save = useCallback(
    async (values: CardioFormValues) => {
      setSaving(true);
      setSaveError(null);
      try {
        const end = values.endTime ?? new Date();
        const start = new Date(end.getTime() - values.durationSec * 1000);
        const session = buildCardioSession({
          activity,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          durationSec: values.durationSec,
          distanceKm: values.distanceKm,
          avgHr: values.avgHr,
          maxHr: values.maxHr,
          inclinePct: values.inclinePct,
          elevationGainM: values.elevationGainM,
          calories: values.calories,
          effort: values.effort,
          runType: values.runType,
          notes: values.notes,
          weightKg,
        });
        await saveWorkoutSession(session);
        rememberLastActivity(activity);
        await refreshData().catch((err: unknown) =>
          logger.workout.warn('cardio: refresh after save failed (saved anyway)', err)
        );
        navigate(`/detail/${session.id}`, { replace: true, state: { justSaved: true } });
      } catch (err: unknown) {
        logger.workout.error('cardio: save failed', err);
        setSaveError('השמירה נכשלה. נסו שוב.');
        setSaving(false);
      }
    },
    [activity, weightKg, refreshData, navigate]
  );

  return (
    <div style={{ background: 'var(--fs-bg)', minHeight: '100%' }} dir="rtl">
      <PageHeader title={`רישום ${cardioActivityConfig(activity).label}`} onBack={goBack} />
      <div className="page-shell" style={{ paddingTop: 16, paddingBottom: 0 }}>
        <CardioEntryForm
          activity={activity}
          onActivityChange={changeActivity}
          showWhen
          weightKg={weightKg}
          submitLabel="שמירה"
          saving={saving}
          saveError={saveError}
          onSubmit={save}
        />
      </div>
    </div>
  );
}
