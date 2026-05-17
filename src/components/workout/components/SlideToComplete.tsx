// SlideToComplete — Fresh Steel slide-to-confirm
// Pill shape (border-radius: 999px) · accent thumb · signal fill · check icon on complete
// Haptic tick on threshold cross, success pattern on complete.
// Keyboard: Enter / Space completes immediately (accessibility fallback).

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';

interface SlideToCompleteProps {
  label: string;
  onComplete: () => void;
  disabled?: boolean;
}

const THUMB_SIZE = 48;
const TRACK_HEIGHT = 56;
const TRACK_PAD = 4;
const THRESHOLD = 0.85;

const SlideToComplete = memo<SlideToCompleteProps>(({ label, onComplete, disabled }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const maxOffsetRef = useRef(0);

  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';
  const sign = isRTL ? -1 : 1;

  const recalcMax = useCallback(() => {
    if (!trackRef.current) return;
    const w = trackRef.current.getBoundingClientRect().width;
    maxOffsetRef.current = Math.max(0, w - THUMB_SIZE - TRACK_PAD * 2);
  }, []);

  useEffect(() => {
    recalcMax();
    window.addEventListener('resize', recalcMax);
    return () => window.removeEventListener('resize', recalcMax);
  }, [recalcMax]);

  const finish = useCallback(() => {
    setIsComplete(true);
    setOffset(maxOffsetRef.current);
    triggerHaptic('success');
    window.setTimeout(() => {
      onComplete();
      setOffset(0);
      setIsComplete(false);
    }, 240);
  }, [onComplete]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || isComplete) return;
    e.preventDefault();
    recalcMax();
    startXRef.current = e.clientX;
    startOffsetRef.current = offset;
    setIsDragging(true);
    triggerHaptic('light');
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const delta = (e.clientX - startXRef.current) * sign;
    setOffset((prev) => {
      const next = Math.max(0, Math.min(maxOffsetRef.current, startOffsetRef.current + delta));
      const prevRatio = maxOffsetRef.current > 0 ? prev / maxOffsetRef.current : 0;
      const nextRatio = maxOffsetRef.current > 0 ? next / maxOffsetRef.current : 0;
      if (nextRatio >= THRESHOLD && prevRatio < THRESHOLD) {
        triggerHaptic('medium');
      }
      return next;
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer may already be released
    }
    setIsDragging(false);
    const ratio = maxOffsetRef.current > 0 ? offset / maxOffsetRef.current : 0;
    if (ratio >= THRESHOLD) {
      finish();
    } else {
      setOffset(0);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || isComplete) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      recalcMax();
      finish();
    }
  };

  const progress = maxOffsetRef.current > 0 ? offset / maxOffsetRef.current : 0;
  const snap = isDragging
    ? 'none'
    : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), width 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease';

  // Pattern fill for track background
  const patternFill = `repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 14px)`;

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className="relative w-full select-none overflow-hidden outline-none"
      style={{
        height: TRACK_HEIGHT,
        background: `${patternFill}, var(--fs-primary)`,
        borderRadius: 999,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    >
      {/* Accent fill — trails behind the thumb with opacity */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          [isRTL ? 'right' : 'left']: 0,
          width: offset + THUMB_SIZE + TRACK_PAD,
          background: 'var(--fs-accent)',
          opacity: 0.12 + progress * 0.2,
          borderRadius: 999,
          transition: snap,
        }}
      />

      {/* Center label — fades as progress grows */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--fs-accent)',
          opacity: 1 - progress * 0.85,
          transition: isDragging ? 'none' : 'opacity 200ms ease',
          padding: `0 ${THUMB_SIZE + TRACK_PAD * 4}px`,
        }}
      >
        {label}
      </div>

      {/* Direction hint (opposite side from thumb start) */}
      <div
        className="absolute pointer-events-none flex items-center"
        style={{
          top: 0,
          bottom: 0,
          [isRTL ? 'left' : 'right']: 14,
          color: 'color-mix(in srgb, var(--fs-accent) 40%, transparent)',
          opacity: 1 - progress,
          transition: isDragging ? 'none' : 'opacity 200ms ease',
        }}
        aria-hidden
      >
        {isRTL ? (
          <ChevronLeft size={16} strokeWidth={3} />
        ) : (
          <ChevronRight size={16} strokeWidth={3} />
        )}
      </div>

      {/* Thumb (pointer events handled on parent) */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: TRACK_PAD,
          width: THUMB_SIZE,
          height: TRACK_HEIGHT - TRACK_PAD * 2,
          [isRTL ? 'right' : 'left']: TRACK_PAD,
          transform: `translateX(${offset * sign}px)`,
          background: 'var(--fs-accent)',
          color: '#FFFFFF',
          borderRadius: 999,
          transition: snap,
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
        aria-hidden
      >
        {isComplete ? (
          <Check size={20} strokeWidth={3} />
        ) : isRTL ? (
          <ChevronLeft size={20} strokeWidth={3} />
        ) : (
          <ChevronRight size={20} strokeWidth={3} />
        )}
      </div>
    </div>
  );
});

SlideToComplete.displayName = 'SlideToComplete';

export default SlideToComplete;
