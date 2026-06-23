// ============================================================================
// BodyTab — grouped "גוף" section (weight + measurements + photos).
// ============================================================================
// Merges the former Weight and Measurements tabs behind a secondary segmented
// control, and adds a trainee progress-photo timeline ("תמונות"). Each sub-area
// keeps all of its original functionality (weight hero + BMI + trend,
// measurements table + diffs) — only regrouped.
//
// The photo timeline reuses the SAME check-in storage path the coach
// PhotoTimeline reads (check_ins.photos JSONB + the progress-photos bucket) —
// no new DB table — and reuses its PhotoCard / Lightbox rendering primitives.

import { Camera, Scale } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import type {
  BodyMeasurement,
  BodyWeightEntry,
  WeightTrend,
} from '../../../services/bodyStatsService';
import {
  getPhotoUrls,
  listCheckIns,
  submitCheckIn,
  updateCheckInPhotos,
  uploadCheckInPhotos,
} from '../../../services/coach/checkInService';
import { logger } from '../../../utils/logger';
import {
  Lightbox,
  PhotoCard,
  type TimelinePhoto,
  flattenPhotos,
} from '../../coach/client/PhotoTimeline';
import { ChapterBreak } from '../components/ChapterBreak';
import { SectionCard } from '../components/SectionCard';
import { type SegmentOption, SegmentedControl } from '../components/SegmentedControl';
import type { BodySubTab } from '../types';
import { MeasurementsSection } from './MeasurementsSection';
import { WeightSection } from './WeightSection';

const SUB_TABS: readonly SegmentOption<BodySubTab>[] = [
  { key: 'weight', label: 'משקל' },
  { key: 'measurements', label: 'מידות' },
  { key: 'photos', label: 'תמונות' },
];

const todayISO = (): string => new Date().toISOString().slice(0, 10);

// ----------------------------------------------------------------------------
// PhotoSection — trainee's own progress-photo timeline (self-service).
// ----------------------------------------------------------------------------

const photoKicker: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.15em',
  color: 'var(--fs-muted)',
  textTransform: 'uppercase',
};

/** "אז והיום" two-up compare — earliest vs latest, dir=rtl (earlier on the right). */
function ThenAndNow({
  first,
  last,
  urls,
}: {
  first: TimelinePhoto;
  last: TimelinePhoto;
  urls: Map<string, string>;
}) {
  return (
    <SectionCard rail={false} style={{ padding: 16, marginTop: 12 }}>
      <h3 style={{ ...photoKicker, marginBottom: 10 }}>אז והיום · THEN & NOW</h3>
      <div dir="rtl" className="grid grid-cols-2 gap-3">
        {[first, last].map((p, i) => (
          <figure key={p.key} className="m-0 min-w-0">
            <div
              style={{
                aspectRatio: '1 / 1',
                background: 'var(--fs-surface-2)',
                overflow: 'hidden',
                borderRadius: 8,
              }}
            >
              {urls.get(p.ref.path) ? (
                <img
                  src={urls.get(p.ref.path)}
                  alt={`תמונת התקדמות מתאריך ${p.date}`}
                  loading="lazy"
                  className="w-full h-full"
                  style={{ objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span
                  className="flex items-center justify-center w-full h-full"
                  style={{ ...photoKicker, fontSize: 10 }}
                >
                  —
                </span>
              )}
            </div>
            <figcaption dir="ltr" style={{ ...photoKicker, fontSize: 9, marginTop: 4 }}>
              {i === 0 ? 'אז' : 'היום'} · {p.date}
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionCard>
  );
}

const PhotoSection = memo(function PhotoSection() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [photos, setPhotos] = useState<TimelinePhoto[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxKey, setLightboxKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const checkIns = await listCheckIns(userId);
      const flat = flattenPhotos(checkIns);
      const signed = await getPhotoUrls(flat.map((p) => p.ref));
      if (!mountedRef.current) return;
      setPhotos(flat);
      setUrls(signed);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  // Capture/upload: create a dated check-in row, upload the photo(s), patch the
  // row's photo refs, then reload. Errors surface inline (never a silent fail).
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        const created = await submitCheckIn({ date: todayISO() });
        if (created.error || !created.id) {
          throw new Error(created.error ?? 'create_failed');
        }
        const { refs, errors } = await uploadCheckInPhotos(created.id, Array.from(files));
        if (refs.length === 0) {
          throw new Error(errors[0] ?? 'upload_failed');
        }
        const patched = await updateCheckInPhotos(created.id, refs);
        if (patched.error) throw new Error(patched.error);
        await load();
      } catch (err) {
        logger.db?.error?.('PhotoSection: upload failed', err);
        if (mountedRef.current) setError('העלאת התמונה נכשלה. נסו שוב.');
      } finally {
        if (mountedRef.current) setUploading(false);
      }
    },
    [load]
  );

  const lightboxPhoto = lightboxKey ? photos.find((p) => p.key === lightboxKey) : undefined;
  const oldest = photos.length > 0 ? photos[photos.length - 1]! : null;
  const newest = photos.length > 0 ? photos[0]! : null;
  const canCompare = oldest && newest && oldest.key !== newest.key;

  const AddButton = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="העלאת תמונת התקדמות"
        className="sr-only"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || !userId}
        className="btn-primary w-full flex items-center justify-center gap-2 active:scale-[0.98] motion-reduce:active:scale-100 disabled:opacity-60"
        style={{ minHeight: 44 }}
      >
        <Camera size={18} aria-hidden="true" />
        {uploading ? 'מעלה…' : 'הוסיפו תמונה'}
      </button>
    </>
  );

  // State 0: signed-out / guest — photos sync needs an account.
  if (!userId) {
    return (
      <SectionCard rail={false} style={{ padding: 20 }}>
        <div className="flex flex-col items-center py-8 text-center gap-3">
          <Camera size={32} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
          <p style={{ fontSize: 13, color: 'var(--fs-muted)', lineHeight: 1.5 }}>
            תמונות ההתקדמות נשמרות לחשבון — התחברו כדי לתעד אותן.
          </p>
        </div>
      </SectionCard>
    );
  }

  // State 1: loading skeleton (matches the 3-col thumbnail grid shape).
  if (loading) {
    return (
      <SectionCard rail={false} style={{ padding: 16 }}>
        <h3 style={{ ...photoKicker, marginBottom: 12 }}>תמונות התקדמות · PROGRESS</h3>
        <div className="grid grid-cols-3 gap-2" role="status" aria-busy="true" aria-label="טוען">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count placeholders, never reordered
              key={i}
              style={{
                aspectRatio: '1 / 1',
                background: 'var(--fs-surface-2)',
                borderRadius: 8,
              }}
            />
          ))}
        </div>
      </SectionCard>
    );
  }

  // State 2: error with retry.
  if (error && photos.length === 0) {
    return (
      <SectionCard rail={false} style={{ padding: 20 }}>
        <div className="flex flex-col items-center gap-3 text-center" role="alert">
          <p style={{ fontSize: 14, color: 'var(--fs-muted)', lineHeight: 1.6 }}>
            לא ניתן לטעון את התמונות. בדקו את החיבור לאינטרנט ונסו שוב.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary active:scale-[0.98] motion-reduce:active:scale-100"
            style={{ minHeight: 44 }}
          >
            נסו שוב
          </button>
        </div>
      </SectionCard>
    );
  }

  // State 3: composed empty — shows HOW to populate.
  if (photos.length === 0) {
    return (
      <SectionCard rail={false} style={{ padding: 20 }}>
        <div className="flex flex-col items-center py-6 text-center gap-3">
          <Camera size={32} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
          <p style={{ fontSize: 13, color: 'var(--fs-muted)', lineHeight: 1.5 }}>
            עדיין אין תמונות התקדמות — צלמו את הראשונה כדי לראות את השינוי לאורך זמן.
          </p>
          {error && (
            <p style={{ fontSize: 12, color: 'var(--color-error)' }} role="alert">
              {error}
            </p>
          )}
          {AddButton}
        </div>
      </SectionCard>
    );
  }

  // State 4: success — timeline + compare + add action.
  return (
    <div className="space-y-3">
      <SectionCard rail={false} style={{ padding: 16 }}>
        <div className="flex items-baseline justify-between gap-2" style={{ marginBottom: 12 }}>
          <h3 style={photoKicker}>תמונות התקדמות · PROGRESS</h3>
          <span style={{ ...photoKicker, fontSize: 9 }} dir="ltr">
            {photos.length}
          </span>
        </div>
        {/* Horizontally scrollable thumbnail timeline (newest-first). */}
        <div
          className="flex gap-2 overflow-x-auto"
          style={{ paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {photos.map((p) => (
            <div key={p.key} className="shrink-0" style={{ width: 104 }}>
              <PhotoCard
                photo={p}
                url={urls.get(p.ref.path)}
                selectable={false}
                selected={false}
                onActivate={() => setLightboxKey(p.key)}
              />
            </div>
          ))}
        </div>
        {error && (
          <div
            className="flex items-center justify-between gap-3 flex-wrap"
            style={{ marginTop: 8 }}
            role="alert"
          >
            <p style={{ fontSize: 12, color: 'var(--color-error)', margin: 0 }}>{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="active:scale-[0.98] motion-reduce:active:scale-100"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--fs-link)',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              רענון
            </button>
          </div>
        )}
      </SectionCard>

      {canCompare && oldest && newest && <ThenAndNow first={oldest} last={newest} urls={urls} />}

      {AddButton}

      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          url={urls.get(lightboxPhoto.ref.path)}
          onClose={() => setLightboxKey(null)}
        />
      )}
    </div>
  );
});

export const BodyTab = memo(function BodyTab({
  latestWeight,
  weightTrend,
  bmi,
  bmiCategory,
  weightEntries,
  latestMeasurement,
  measurements,
  onAddWeight,
  onAddMeasurement,
}: {
  latestWeight: BodyWeightEntry | null;
  weightTrend: WeightTrend | null;
  bmi: number | null;
  bmiCategory: { label: string; color: string } | null;
  weightEntries: BodyWeightEntry[];
  latestMeasurement: BodyMeasurement | null;
  measurements: BodyMeasurement[];
  onAddWeight: () => void;
  onAddMeasurement: () => void;
}) {
  const [sub, setSub] = useState<BodySubTab>('weight');

  // Composed empty state (parity with Overview/Recovery) when there is no body
  // data at all — weight nor measurements — rather than two bare sub-sections.
  // The photo sub-tab is still independently reachable from this empty state, so
  // it only short-circuits when the active sub-tab is not photos.
  const hasNoBodyData =
    !latestWeight && weightEntries.length === 0 && !latestMeasurement && measurements.length === 0;

  if (hasNoBodyData && sub !== 'photos') {
    return (
      <div className="space-y-4">
        <ChapterBreak title="גוף" />
        <SegmentedControl
          options={SUB_TABS}
          value={sub}
          onChange={setSub}
          ariaLabel="תצוגת גוף"
          idPrefix="body-sub"
        />
        <SectionCard rail={false}>
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <Scale size={32} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
            <p style={{ fontSize: 14, color: 'var(--fs-muted)' }}>
              עדיין אין נתוני גוף — תיעוד המשקל הראשון יתחיל את המעקב.
            </p>
            <button
              type="button"
              onClick={onAddWeight}
              className="btn-primary"
              style={{ minHeight: 44 }}
            >
              הוסף משקל
            </button>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChapterBreak title="גוף" />

      <SegmentedControl
        options={SUB_TABS}
        value={sub}
        onChange={setSub}
        ariaLabel="תצוגת גוף"
        idPrefix="body-sub"
      />

      {sub === 'weight' && (
        <div id="body-sub-panel-weight" role="tabpanel" aria-labelledby="body-sub-tab-weight">
          <WeightSection
            latestWeight={latestWeight}
            weightTrend={weightTrend}
            bmi={bmi}
            bmiCategory={bmiCategory}
            weightEntries={weightEntries}
            onAdd={onAddWeight}
          />
        </div>
      )}
      {sub === 'measurements' && (
        <div
          id="body-sub-panel-measurements"
          role="tabpanel"
          aria-labelledby="body-sub-tab-measurements"
        >
          <MeasurementsSection
            latestMeasurement={latestMeasurement}
            measurements={measurements}
            onAdd={onAddMeasurement}
          />
        </div>
      )}
      {sub === 'photos' && (
        <div id="body-sub-panel-photos" role="tabpanel" aria-labelledby="body-sub-tab-photos">
          <PhotoSection />
        </div>
      )}
    </div>
  );
});

export default BodyTab;
