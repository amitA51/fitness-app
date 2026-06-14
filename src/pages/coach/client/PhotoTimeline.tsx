// Fresh Steel / Obsidian design system — coach progress-photo timeline.
// Reads a client's check-ins, flattens every attached photo newest-first, signs
// the storage paths in one batch, and renders a chronological grid. Tapping a
// photo opens a lightbox; a compare toggle lets the coach pick two photos and
// view them side by side. Read-only — the coach never uploads or deletes here.

import { GitCompareArrows, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ModalOverlay } from '../../../components/ui/ModalOverlay';
import type { PhotoRef } from '../../../services/coach/checkInService';
import { getPhotoUrls, listCheckIns } from '../../../services/coach/checkInService';
import { InlineEmpty, Section, SectionError, formatDate } from '../_shared';

/** One photo flattened out of its check-in, carrying the check-in's date. */
export interface TimelinePhoto {
  ref: PhotoRef;
  date: string;
  /** Stable key — the storage path is unique per photo. */
  key: string;
}

/** Flatten check-ins (already newest-first) into a photo list, newest-first. */
export function flattenPhotos(
  checkIns: Array<{ date: string; photos: PhotoRef[] }>
): TimelinePhoto[] {
  return checkIns.flatMap((ci) => ci.photos.map((ref) => ({ ref, date: ci.date, key: ref.path })));
}

interface PhotoCardProps {
  photo: TimelinePhoto;
  url: string | undefined;
  selectable: boolean;
  selected: boolean;
  onActivate: () => void;
}

export function PhotoCard({ photo, url, selectable, selected, onActivate }: PhotoCardProps) {
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-pressed={selectable ? selected : undefined}
      className="relative active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
      style={{
        aspectRatio: '1 / 1',
        padding: 0,
        background: 'var(--fs-surface-2)',
        border: selected ? '2px solid var(--fs-accent)' : '1px solid var(--fs-surface-2)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {url ? (
        <img
          src={url}
          loading="lazy"
          alt={`תמונת התקדמות מתאריך ${formatDate(photo.date)}`}
          className="w-full h-full"
          style={{ objectFit: 'cover', display: 'block' }}
        />
      ) : (
        // Signed URL missing (sign failed / expired) — labelled placeholder.
        <span
          className="flex items-center justify-center w-full h-full"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fs-muted)' }}
        >
          —
        </span>
      )}
      <span
        className="absolute"
        dir="ltr"
        style={{
          bottom: 0,
          insetInlineStart: 0,
          padding: '2px 6px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--color-ink-on-dark)',
          background: 'color-mix(in srgb, var(--fs-primary) 70%, transparent)',
        }}
      >
        {formatDate(photo.date)}
      </span>
    </button>
  );
}

interface LightboxProps {
  photo: TimelinePhoto;
  url: string | undefined;
  onClose: () => void;
}

export function Lightbox({ photo, url, onClose }: LightboxProps) {
  return (
    <ModalOverlay
      isOpen
      onClose={onClose}
      variant="fullscreen"
      backdropOpacity={90}
      ariaLabel={`תמונת התקדמות מתאריך ${formatDate(photo.date)}`}
    >
      <div
        dir="rtl"
        className="relative w-full h-full flex items-center justify-center"
        style={{ padding: 16 }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירה"
          className="absolute active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            insetInlineEnd: 16,
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--fs-surface)',
            color: 'var(--fs-ink)',
            border: '1px solid var(--fs-surface-2)',
            cursor: 'pointer',
          }}
        >
          <X size={20} aria-hidden="true" />
        </button>
        {url && (
          <figure className="flex flex-col items-center gap-3 m-0">
            <img
              src={url}
              alt={`תמונת התקדמות מתאריך ${formatDate(photo.date)}`}
              style={{ maxWidth: '92vw', maxHeight: '78vh', objectFit: 'contain' }}
            />
            <figcaption
              dir="ltr"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--color-ink-on-dark)',
              }}
            >
              {formatDate(photo.date)}
            </figcaption>
          </figure>
        )}
      </div>
    </ModalOverlay>
  );
}

interface CompareViewProps {
  pair: [TimelinePhoto, TimelinePhoto];
  urls: Map<string, string>;
  onClose: () => void;
}

function CompareView({ pair, urls, onClose }: CompareViewProps) {
  const [first, second] = pair;
  return (
    <ModalOverlay
      isOpen
      onClose={onClose}
      variant="fullscreen"
      backdropOpacity={90}
      ariaLabel="השוואת תמונות התקדמות"
    >
      {/* dir=rtl: the earlier-date photo sits on the inline-start (right). */}
      <div dir="rtl" className="relative w-full h-full flex flex-col" style={{ padding: 16 }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירה"
          className="absolute active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            insetInlineEnd: 16,
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--fs-surface)',
            color: 'var(--fs-ink)',
            border: '1px solid var(--fs-surface-2)',
            cursor: 'pointer',
            zIndex: 1,
          }}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className="flex-1 grid grid-cols-2 gap-3 items-center" style={{ marginTop: 56 }}>
          {[first, second].map((p) => (
            <figure key={p.key} className="flex flex-col items-center gap-2 m-0 min-w-0">
              <img
                src={urls.get(p.ref.path)}
                alt={`תמונת התקדמות מתאריך ${formatDate(p.date)}`}
                style={{ maxWidth: '100%', maxHeight: '74vh', objectFit: 'contain' }}
              />
              <figcaption
                dir="ltr"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--color-ink-on-dark)',
                }}
              >
                {formatDate(p.date)}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </ModalOverlay>
  );
}

/** Number of items a coach selects before the compare view opens. */
const COMPARE_PICK_COUNT = 2;

export function PhotoTimeline({ clientId }: { clientId: string }) {
  const [photos, setPhotos] = useState<TimelinePhoto[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [lightboxKey, setLightboxKey] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const checkIns = await listCheckIns(clientId);
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
  }, [clientId]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const comparePair = useMemo((): [TimelinePhoto, TimelinePhoto] | null => {
    if (picked.length < COMPARE_PICK_COUNT) return null;
    const a = photos.find((p) => p.key === picked[0]);
    const b = photos.find((p) => p.key === picked[1]);
    return a && b ? [a, b] : null;
  }, [picked, photos]);

  const lightboxPhoto = useMemo(
    () => (lightboxKey ? (photos.find((p) => p.key === lightboxKey) ?? null) : null),
    [lightboxKey, photos]
  );

  const toggleCompare = () => {
    setCompareMode((on) => !on);
    setPicked([]);
  };

  const handleActivate = (key: string) => {
    if (!compareMode) {
      setLightboxKey(key);
      return;
    }
    setPicked((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= COMPARE_PICK_COUNT) return prev;
      return [...prev, key];
    });
  };

  return (
    <Section title="תמונות התקדמות">
      {photos.length > 0 && !loading && !error && (
        <div className="flex items-center justify-between mb-3 gap-2">
          <button
            type="button"
            onClick={toggleCompare}
            aria-pressed={compareMode}
            className="active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 44,
              padding: '0 14px',
              background: compareMode ? 'var(--fs-primary)' : 'var(--fs-surface)',
              color: compareMode ? 'var(--fs-accent)' : 'var(--fs-ink)',
              border: '1px solid var(--fs-surface-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            <GitCompareArrows size={15} aria-hidden="true" />
            השוואה
          </button>
          {compareMode && (
            <span
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}
            >
              בחרו <span dir="ltr">{COMPARE_PICK_COUNT}</span> תמונות
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-2" role="status" aria-busy="true" aria-label="טוען">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count placeholders, never reordered
              key={i}
              style={{
                aspectRatio: '1 / 1',
                background: 'var(--fs-surface-2)',
                border: '1px solid var(--fs-surface-2)',
              }}
            />
          ))}
        </div>
      ) : error ? (
        <SectionError onRetry={load} />
      ) : photos.length === 0 ? (
        <InlineEmpty>עדיין אין תמונות התקדמות — אפשר לצרף תמונות בצ׳ק-אין השבועי</InlineEmpty>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <PhotoCard
              key={p.key}
              photo={p}
              url={urls.get(p.ref.path)}
              selectable={compareMode}
              selected={picked.includes(p.key)}
              onActivate={() => handleActivate(p.key)}
            />
          ))}
        </div>
      )}

      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          url={urls.get(lightboxPhoto.ref.path)}
          onClose={() => setLightboxKey(null)}
        />
      )}

      {comparePair && <CompareView pair={comparePair} urls={urls} onClose={() => setPicked([])} />}
    </Section>
  );
}

export default PhotoTimeline;
