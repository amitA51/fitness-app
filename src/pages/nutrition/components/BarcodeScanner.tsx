// ============================================================================
// BarcodeScanner — camera (BarcodeDetector) + manual barcode entry sheet.
// ============================================================================
// Fresh Steel / Obsidian. Opens from AddMealModal's scan button. When the
// browser supports BarcodeDetector (Chrome/Android) it shows a live
// viewfinder and samples frames every ~300ms; everywhere else (iOS Safari)
// it degrades to manual numeric entry of the barcode. Lookup goes through
// Open Food Facts (services/barcodeFood); a found product is added through
// the SAME path as a library food (onAdd → handleAddFood + serving delta).
//
// States: scan (viewfinder/manual) → lookup (inline spinner) → found
// (product card + serving stepper + הוסף) | not-found | error (retry).
// Camera tracks are stopped on phase change, close, and unmount — no leak.

import { m } from 'framer-motion';
import { Loader2, PackageSearch, WifiOff } from 'lucide-react';
import { type CSSProperties, memo, useCallback, useEffect, useRef, useState } from 'react';
import { Sheet } from '../../../components/ui/Sheet';
import {
  createBarcodeDetector,
  isValidBarcode,
  lookupBarcodeFood,
} from '../../../services/barcodeFood';
import type { FoodItem } from '../../../types';
import { MacroGrid } from './shared/MacroGrid';

/** Frame-sampling cadence for BarcodeDetector.detect. */
const SCAN_INTERVAL_MS = 300;
const MIN_SERVINGS = 0.5;
const SERVINGS_STEP = 0.5;

type ScanPhase = 'scan' | 'lookup' | 'found' | 'not-found' | 'error';

interface BarcodeScannerProps {
  /** Whether the sheet is open. */
  isOpen: boolean;
  onClose: () => void;
  /** True when BarcodeDetector camera scanning is available (per feature detect). */
  cameraSupported: boolean;
  /** Add the found food; servings are multiples of 100 גרם (1 = 100g). */
  onAdd: (food: FoodItem, servings: number) => void;
}

export const BarcodeScanner = memo(function BarcodeScanner({
  isOpen,
  onClose,
  cameraSupported,
  onAdd,
}: BarcodeScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>('scan');
  const [cameraDenied, setCameraDenied] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [food, setFood] = useState<FoodItem | null>(null);
  const [servings, setServings] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Ignore late lookup resolutions after the sheet closed/reset.
  const lookupSeqRef = useRef(0);

  // Fresh state each time the sheet opens (also invalidates in-flight lookups).
  useEffect(() => {
    if (!isOpen) return;
    lookupSeqRef.current += 1;
    setPhase('scan');
    setCameraDenied(false);
    setManualCode('');
    setLastCode('');
    setFood(null);
    setServings(1);
  }, [isOpen]);

  const runLookup = useCallback(async (code: string) => {
    const seq = ++lookupSeqRef.current;
    setLastCode(code);
    setPhase('lookup');
    const result = await lookupBarcodeFood(code);
    if (seq !== lookupSeqRef.current) return;
    if (result.status === 'found') {
      setFood(result.food);
      setServings(1);
      setPhase('found');
    } else {
      setPhase(result.status === 'not-found' ? 'not-found' : 'error');
    }
  }, []);

  // Camera lifecycle — runs only while the sheet is open in the scan phase.
  // Cleanup stops EVERY track on phase change, close, and unmount.
  useEffect(() => {
    if (!isOpen || !cameraSupported || cameraDenied || phase !== 'scan') return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let intervalId: number | undefined;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch {
        if (!cancelled) setCameraDenied(true);
        return;
      }
      if (cancelled) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }
      const video = videoRef.current;
      const detector = createBarcodeDetector();
      if (!video || !detector) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* play() interrupted by close — cleanup stops the tracks */
      }
      let detecting = false;
      intervalId = window.setInterval(async () => {
        const v = videoRef.current;
        // readyState < 2 → no frame data yet; detecting guard avoids overlap.
        if (cancelled || detecting || !v || v.readyState < 2) return;
        detecting = true;
        try {
          const codes = await detector.detect(v);
          const hit = codes.find((c) => isValidBarcode(c.rawValue));
          if (hit && !cancelled) void runLookup(hit.rawValue.trim());
        } catch {
          /* per-frame detect failures are non-fatal — next tick retries */
        } finally {
          detecting = false;
        }
      }, SCAN_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
      if (stream) for (const t of stream.getTracks()) t.stop();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [isOpen, cameraSupported, cameraDenied, phase, runLookup]);

  const manualValid = isValidBarcode(manualCode);

  const handleAdd = () => {
    if (!food) return;
    onAdd(food, servings);
    onClose();
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="סריקת ברקוד">
      <div className="space-y-4">
        {phase === 'scan' && (
          <>
            {cameraSupported && !cameraDenied && (
              <div>
                {/* Viewfinder */}
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: 'var(--fs-primary)',
                    aspectRatio: '4 / 3',
                  }}
                >
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Scan-line hint over the preview */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      insetInline: '12%',
                      top: '50%',
                      height: 2,
                      borderRadius: 'var(--radius-full)',
                      background: 'color-mix(in srgb, var(--fs-accent) 85%, transparent)',
                    }}
                  />
                </div>
                <p style={HINT_STYLE}>כוונו את המצלמה אל הברקוד שעל האריזה</p>
              </div>
            )}

            {cameraDenied && (
              <div role="alert" style={INLINE_ERROR_STYLE}>
                אין גישה למצלמה. אפשר להקליד את הברקוד ידנית.
              </div>
            )}

            {!cameraSupported && <p style={HINT_STYLE}>הקלידו את מספר הברקוד שמודפס על האריזה</p>}

            {/* Manual entry — always available, label above the input. */}
            <div>
              <label htmlFor="barcode-manual-input" style={LABEL_STYLE}>
                ברקוד (ספרות בלבד)
              </label>
              <div className="flex gap-2">
                <input
                  id="barcode-manual-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualValid) void runLookup(manualCode.trim());
                  }}
                  placeholder="7290000000000"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 48,
                    padding: '12px 16px',
                    backgroundColor: 'var(--fs-surface-2)',
                    border: '1px solid var(--fs-surface-2)',
                    borderRadius: 14,
                    color: 'var(--fs-ink)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <m.button
                  type="button"
                  onClick={() => void runLookup(manualCode.trim())}
                  disabled={!manualValid}
                  whileTap={{ scale: manualValid ? 0.98 : 1 }}
                  style={{
                    minHeight: 48,
                    paddingInline: 18,
                    borderRadius: 14,
                    border: 'none',
                    backgroundColor: manualValid ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                    color: manualValid ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: manualValid ? 'pointer' : 'not-allowed',
                  }}
                >
                  חיפוש
                </m.button>
              </div>
              <p style={{ ...HINT_STYLE, marginTop: 6 }}>8–14 ספרות, כמו על גבי האריזה</p>
            </div>
          </>
        )}

        {phase === 'lookup' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
            <Loader2
              size={26}
              className="animate-spin motion-reduce:animate-none"
              style={{ color: 'var(--fs-accent)' }}
              aria-hidden="true"
            />
            <p style={{ ...HINT_STYLE, marginTop: 0 }}>
              מחפש את המוצר…{' '}
              <span dir="ltr" style={{ fontFamily: 'var(--font-mono)' }}>
                {lastCode}
              </span>
            </p>
          </div>
        )}

        {phase === 'found' && food && (
          <div className="space-y-4">
            {/* Product card — name/brand + per-100g macros */}
            <div
              style={{
                backgroundColor: 'var(--fs-surface-2)',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--fs-ink)',
                  margin: 0,
                }}
              >
                {food.name}
              </p>
              {food.brand && (
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--fs-muted)',
                    margin: '2px 0 0',
                  }}
                >
                  {food.brand}
                </p>
              )}
              <p style={{ ...KICKER_STYLE, margin: '10px 0 6px' }}>ל־100 גרם</p>
              <MacroGrid macros={food} variant="inline" />
            </div>

            {/* Serving amount — same 0.5-step granularity as the Add sheet. */}
            <div className="flex items-center justify-between">
              <span id="barcode-servings-label" style={LABEL_STYLE}>
                כמות מנות (מנה = 100 גרם)
              </span>
              <div
                className="flex items-center gap-2"
                role="group"
                aria-labelledby="barcode-servings-label"
              >
                <button
                  type="button"
                  onClick={() => setServings((s) => Math.max(MIN_SERVINGS, s - SERVINGS_STEP))}
                  style={STEPPER_BUTTON_STYLE}
                  aria-label="הפחת חצי מנה"
                >
                  −
                </button>
                <span
                  dir="ltr"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                    width: 32,
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {servings}
                </span>
                <button
                  type="button"
                  onClick={() => setServings((s) => s + SERVINGS_STEP)}
                  style={STEPPER_BUTTON_STYLE}
                  aria-label="הוסף חצי מנה"
                >
                  +
                </button>
              </div>
            </div>

            <m.button
              type="button"
              onClick={handleAdd}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%',
                minHeight: 52,
                borderRadius: 14,
                border: 'none',
                backgroundColor: 'var(--fs-accent)',
                color: 'var(--color-ink-on-accent)',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 16,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              הוסף
            </m.button>
          </div>
        )}

        {phase === 'not-found' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <PackageSearch size={28} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
            <p style={{ ...HINT_STYLE, marginTop: 0 }}>
              המוצר לא נמצא במאגר — אפשר להוסיף ידנית מחיפוש המזון
            </p>
            <button type="button" onClick={() => setPhase('scan')} style={RETRY_BUTTON_STYLE}>
              סריקה נוספת
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center" role="alert">
            <WifiOff size={28} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
            <p style={{ ...HINT_STYLE, marginTop: 0 }}>
              החיפוש נכשל. בדקו את החיבור לאינטרנט ונסו שוב.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void runLookup(lastCode)}
                style={RETRY_BUTTON_STYLE}
              >
                נסו שוב
              </button>
              <button type="button" onClick={() => setPhase('scan')} style={RETRY_BUTTON_STYLE}>
                סריקה נוספת
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
});

const HINT_STYLE: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  color: 'var(--fs-muted)',
  marginTop: 8,
  marginBottom: 0,
};

const LABEL_STYLE: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-hebrew)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--fs-ink)',
  marginBottom: 6,
};

const KICKER_STYLE: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--fs-muted)',
};

const INLINE_ERROR_STYLE: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  color: 'var(--color-error)',
  backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, var(--fs-surface-2))',
  border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
  borderRadius: 14,
  padding: '12px 14px',
};

const STEPPER_BUTTON_STYLE: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  backgroundColor: 'var(--fs-surface)',
  color: 'var(--fs-ink)',
  border: '1px solid var(--fs-surface-2)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: 18,
};

const RETRY_BUTTON_STYLE: CSSProperties = {
  minHeight: 44,
  paddingInline: 18,
  borderRadius: 14,
  border: '1px solid var(--fs-surface-2)',
  backgroundColor: 'var(--fs-surface-2)',
  color: 'var(--fs-ink)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
