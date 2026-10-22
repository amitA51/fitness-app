// ============================================================================
// CardioLivePage (/cardio/live?activity=run) — track an effort as it happens.
// ============================================================================
// Clock for every activity; GPS distance, live pace, km splits and a spoken
// update each kilometre for the outdoor ones. Finishing opens the same form as
// manual logging, pre-filled with what was measured, so the user can correct a
// treadmill distance or add heart rate before saving.

import { MapPin, Pause, Play, Square, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SettingsToggle } from '../../components/ui/SettingsToggle';
import { useData } from '../../contexts/DataContext';
import { requestReminderPermission } from '../../services/localRemindersSync';
import { readLastActivity, rememberLastActivity } from '../../services/running/cardioPrefs';
import { saveWorkoutSession } from '../../services/sessionDb';
import type { CardioActivity, CardioSplit } from '../../types';
import {
  UNIT_KM,
  buildCardioSession,
  cardioActivityConfig,
  cardioPace,
  formatClock,
  formatKm,
  formatPace,
  isCardioActivity,
  paceByStyle,
} from '../../utils/cardio';
import { logger } from '../../utils/logger';
import { CardioEntryForm, type CardioFormValues } from './components/CardioEntryForm';
import { secToDurationParts } from './components/DurationField';
import { simplifyRoute } from './live/geo';
import { hasBackgroundGps } from './live/geoSource';
import {
  announce,
  readVoicePref,
  splitAnnouncement,
  useScreenAwake,
  writeVoicePref,
} from './live/liveFeedback';
import { type GpsStatus, useLiveTracker } from './live/useLiveTracker';
import { useBodyWeightKg } from './useBodyWeightKg';
import './cardio.css';

const GPS_TEXT: Record<GpsStatus, { text: string; tone: 'good' | 'warn' | 'neutral' }> = {
  off: { text: 'GPS כבוי', tone: 'neutral' },
  searching: { text: 'מחפשים GPS…', tone: 'neutral' },
  good: { text: 'GPS תקין', tone: 'good' },
  weak: { text: 'קליטה חלשה', tone: 'warn' },
  denied: { text: 'אין הרשאה למיקום', tone: 'warn' },
  unavailable: { text: 'GPS לא זמין', tone: 'warn' },
};

export default function CardioLivePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refreshData } = useData();
  const weightKg = useBodyWeightKg();
  const fromQuery = params.get('activity');
  const requested: CardioActivity = isCardioActivity(fromQuery) ? fromQuery : readLastActivity();

  const [voice, setVoice] = useState(readVoicePref);
  const onSplit = useCallback(
    (split: CardioSplit) => {
      if (voice) announce(splitAnnouncement(split));
    },
    [voice]
  );
  const t = useLiveTracker(requested, onSplit);
  const config = cardioActivityConfig(t.activity);

  const [confirmExit, setConfirmExit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useScreenAwake(t.phase === 'running');

  // Android 13+: the tracking notification (which keeps GPS alive with the
  // screen off) needs the notification permission. Ask at the moment it is
  // needed — tapping "התחלה" on an outdoor activity — never on screen open.
  // Awaited: Android runs one permission dialog at a time, and the location
  // request the GPS watcher makes would otherwise be cancelled by this one.
  const [starting, setStarting] = useState(false);
  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      if (t.usesGps && hasBackgroundGps()) {
        await requestReminderPermission().catch(() => undefined);
      }
      t.start();
    } finally {
      setStarting(false);
    }
  };

  const leave = useCallback(() => navigate('/cardio', { replace: true }), [navigate]);

  const onClose = () => {
    if (t.phase === 'ready') leave();
    else setConfirmExit(true);
  };

  const discardAndLeave = () => {
    t.discard();
    setConfirmExit(false);
    leave();
  };

  const toggleVoice = () => {
    setVoice((v) => {
      writeVoicePref(!v);
      return !v;
    });
  };

  const save = async (values: CardioFormValues) => {
    setSaving(true);
    setSaveError(null);
    try {
      const { splits, points } = t.result();
      const start = t.startedAt ?? Date.now() - values.durationSec * 1000;
      const end = t.finishedAt ?? Date.now();
      // Splits only describe the GPS distance; a hand-corrected distance drops them.
      const gpsKm = t.distanceKm;
      const keepSplits =
        t.usesGps && values.distanceKm !== null && Math.abs(values.distanceKm - gpsKm) < 0.05;
      const session = buildCardioSession({
        activity: t.activity,
        startTime: new Date(start).toISOString(),
        endTime: new Date(end).toISOString(),
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
        splits: keepSplits ? splits : undefined,
        route:
          t.usesGps && points.length >= 2
            ? { points: simplifyRoute(points), source: 'gps' }
            : undefined,
        weightKg,
      });
      await saveWorkoutSession(session);
      t.complete();
      rememberLastActivity(t.activity);
      await refreshData().catch((err: unknown) =>
        logger.workout.warn('cardio live: refresh after save failed (saved anyway)', err)
      );
      navigate(`/detail/${session.id}`, { replace: true, state: { justSaved: true } });
    } catch (err: unknown) {
      logger.workout.error('cardio live: save failed', err);
      setSaveError('השמירה נכשלה. האימון לא נמחק, נסו שוב.');
      setSaving(false);
    }
  };

  // ---- finish step: the same form as manual logging, pre-filled -------------
  if (t.phase === 'finished') {
    return (
      <div className="cardio-live" dir="rtl">
        <div className="cardio-live-top">
          <h1 className="cardio-live-title">סיכום {config.label}</h1>
        </div>
        <div className="cardio-live-body">
          <CardioEntryForm
            activity={t.activity}
            showWhen={false}
            initial={{
              durationParts: secToDurationParts(t.movingSec),
              distanceKm: t.usesGps && t.distanceKm > 0 ? t.distanceKm : null,
              elevationGainM: t.elevationGainM > 0 ? t.elevationGainM : null,
            }}
            weightKg={weightKg}
            submitLabel="שמירה"
            saving={saving}
            saveError={saveError}
            onSubmit={save}
            secondary={{ label: 'חזרה לאימון', onClick: t.reopen }}
          />
          <button
            type="button"
            className="cta-ghost focus-ring"
            style={{ color: 'var(--color-error)', marginBottom: 24 }}
            onClick={() => setConfirmExit(true)}
          >
            מחיקת האימון
          </button>
        </div>
        <ConfirmDialog
          isOpen={confirmExit}
          variant="danger"
          title="למחוק את האימון?"
          description="מה שנמדד לא יישמר."
          confirmLabel="מחיקה"
          cancelLabel="ביטול"
          onConfirm={discardAndLeave}
          onCancel={() => setConfirmExit(false)}
        />
      </div>
    );
  }

  // ---- live screen ------------------------------------------------------------
  const avgPace = t.usesGps ? cardioPace(t.activity, t.distanceKm, t.movingSec) : null;
  const currentPace =
    config.paceStyle === 'per_km'
      ? formatPace(t.currentPaceSecPerKm)
      : t.currentPaceSecPerKm
        ? (paceByStyle(config.paceStyle, 1, t.currentPaceSecPerKm)?.value ?? null)
        : null;
  const paceLabel = config.paceStyle === 'speed' ? 'מהירות' : 'קצב';
  const gpsInfo = GPS_TEXT[t.gps];
  const background = hasBackgroundGps();

  return (
    <div className="cardio-live" dir="rtl">
      <div className="cardio-live-top">
        <button
          type="button"
          className="cardio-icon-btn focus-ring"
          aria-label="סגירה"
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <h1 className="cardio-live-title">{config.label}</h1>
        {t.usesGps && t.phase !== 'ready' && (
          <span className="cardio-status" data-tone={gpsInfo.tone} role="status">
            <MapPin size={14} aria-hidden="true" />
            {gpsInfo.text}
          </span>
        )}
      </div>

      <div className="cardio-live-body">
        {t.restored && t.phase !== 'ready' && <p className="cardio-note">המשכנו מאיפה שעצרתם.</p>}

        <div className="cardio-live-hero">
          <span className="cardio-live-hero-value kinetic-number" aria-live="off">
            {formatClock(t.movingSec)}
          </span>
          <span className="cardio-live-label">
            {t.autoPaused
              ? 'עצירה אוטומטית — ממשיכים כשתזוזו'
              : t.phase === 'paused'
                ? 'בהשהיה'
                : 'זמן'}
          </span>
        </div>

        {t.usesGps ? (
          <div className="cardio-live-stats">
            <div className="cardio-live-stat">
              <span className="cardio-live-label">מרחק</span>
              <span className="cardio-live-stat-value kinetic-number">
                {formatKm(t.distanceKm)}
              </span>
              <span className="cardio-live-stat-unit">{UNIT_KM}</span>
            </div>
            <div className="cardio-live-stat">
              <span className="cardio-live-label">{paceLabel} עכשיו</span>
              <span className="cardio-live-stat-value kinetic-number">{currentPace ?? '—'}</span>
              <span className="cardio-live-stat-unit">
                {avgPace ? (
                  <>
                    ממוצע <span className="kinetic-number">{avgPace.value}</span> {avgPace.unit}
                  </>
                ) : (
                  (cardioPace(t.activity, 1, 300)?.unit ?? '')
                )}
              </span>
            </div>
          </div>
        ) : (
          <p className="cardio-note">
            {config.distanceMatters
              ? 'את המרחק מהמכשיר תרשמו בסיום.'
              : 'בסיום תוכלו להוסיף דופק וקלוריות מהשעון.'}
          </p>
        )}

        {t.usesGps && !background && (
          <p className="cardio-note">
            בדפדפן המדידה נעצרת כשהמסך כבוי, אז המסך יישאר דלוק. באפליקציה לאנדרואיד המדידה ממשיכה
            גם עם מסך כבוי.
          </p>
        )}

        {(t.gps === 'denied' || t.gps === 'unavailable') && (
          <p className="cardio-note" role="alert">
            {t.gps === 'denied'
              ? 'כדי למדוד מרחק צריך לאשר גישה למיקום בהגדרות הטלפון. השעון ממשיך לרוץ, ואת המרחק אפשר לרשום בסיום.'
              : 'לא מצאנו GPS. השעון ממשיך לרוץ, ואת המרחק אפשר לרשום בסיום.'}
          </p>
        )}

        {t.splits.length > 0 && (
          <section aria-label="קילומטרים">
            <ul className="cardio-splits">
              {[...t.splits]
                .reverse()
                .slice(0, 5)
                .map((s) => (
                  <li key={s.index}>
                    <span>
                      ק״מ <span className="kinetic-number">{s.index}</span>
                    </span>
                    <span>
                      <span className="kinetic-number">{formatPace(s.seconds / s.distanceKm)}</span>{' '}
                      דק׳/ק״מ
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {t.phase !== 'running' && (
          <div className="cardio-toggles">
            {t.usesGps && (
              <div className="cardio-toggle-row">
                <span>עצירה אוטומטית כשעומדים</span>
                <SettingsToggle
                  checked={t.autoPause}
                  onChange={() => t.setAutoPause(!t.autoPause)}
                  label="עצירה אוטומטית כשעומדים"
                />
              </div>
            )}
            {t.usesGps && (
              <div className="cardio-toggle-row">
                <span>עדכון קולי בכל קילומטר</span>
                <SettingsToggle
                  checked={voice}
                  onChange={toggleVoice}
                  label="עדכון קולי בכל קילומטר"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cardio-live-controls">
        {t.phase === 'ready' && (
          <button
            type="button"
            className="cardio-round-btn focus-ring"
            data-kind="go"
            onClick={start}
          >
            <Play size={28} aria-hidden="true" />
            התחלה
          </button>
        )}
        {t.phase === 'running' && (
          <button
            type="button"
            className="cardio-round-btn focus-ring"
            data-kind="pause"
            onClick={t.pause}
          >
            <Pause size={28} aria-hidden="true" />
            השהיה
          </button>
        )}
        {t.phase === 'paused' && (
          <button
            type="button"
            className="cardio-round-btn focus-ring"
            data-kind="go"
            onClick={t.resume}
          >
            <Play size={28} aria-hidden="true" />
            המשך
          </button>
        )}
        {(t.phase === 'running' || t.phase === 'paused') && (
          <button
            type="button"
            className="cardio-round-btn focus-ring"
            data-kind="stop"
            onClick={t.finish}
          >
            <Square size={24} aria-hidden="true" />
            סיום
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmExit}
        variant="danger"
        title="לעצור ולמחוק את האימון?"
        description="כדי לשמור, לחצו על ״סיום״. מחיקה תמחק את מה שנמדד עד עכשיו."
        confirmLabel="מחיקה"
        cancelLabel="חזרה לאימון"
        onConfirm={discardAndLeave}
        onCancel={() => setConfirmExit(false)}
      />
    </div>
  );
}
