// ============================================================================
// gsapSparks - shared particle-burst factory (Physics2D).
// ----------------------------------------------------------------------------
// One source of truth for every celebratory particle effect: PR confetti,
// set-complete sparks, workout-complete puff. Creates lightweight DOM nodes,
// animates them with real gravity/velocity via Physics2DPlugin, and removes
// them on complete. Returns the timeline so callers can chain or await.
//
// RTL: the default burst is radially symmetric (angle 0-360) OR a vertically
// symmetric fan (centered on 270 = straight up), so NO horizontal mirroring is
// needed. Only add a left/right bias if you mirror it yourself for dir.
//
// Reduced motion: callers MUST guard (this factory always animates if called).
// ============================================================================

import { gsap } from './gsap';

/** Default celebratory palette (mirrors PRCelebration's existing colors). */
export const SPARK_COLORS = ['#E8B82D', '#F5F1EB', '#35B392', '#7E7D78', '#EAE4DA'];

export interface SparkBurstOptions {
  /** Number of particles. Keep <= 60 for 60fps on mid-range phones. */
  count?: number;
  /** Color palette to cycle through. */
  colors?: string[];
  /** Burst origin X within the container, px from left. Default: center. */
  originX?: number;
  /** Burst origin Y within the container, px from top. Default: center. */
  originY?: number;
  /** Min launch velocity (px/s). */
  minVelocity?: number;
  /** Max launch velocity (px/s). */
  maxVelocity?: number;
  /** Gravity (px/s^2). Positive = downward. */
  gravity?: number;
  /** Min launch angle in degrees (0 = right, 90 = down, 270 = up). */
  angleMin?: number;
  /** Max launch angle in degrees. */
  angleMax?: number;
  /** Min particle size (px). */
  sizeMin?: number;
  /** Max particle size (px). */
  sizeMax?: number;
  /** Tween duration (s). */
  duration?: number;
  /** Mix circles and squares. Default true. */
  mixedShapes?: boolean;
  /** Called when the whole burst finishes (after nodes removed). */
  onComplete?: () => void;
}

/**
 * Fire a particle burst inside `container`. The container should be
 * position:relative (or absolute) and ideally overflow:visible so particles
 * can travel outside its box. Particles are absolutely positioned at the
 * origin and removed when the tween completes.
 *
 * @returns the GSAP timeline (already playing), or null if container missing.
 */
export function fireSparks(
  container: HTMLElement | null,
  options: SparkBurstOptions = {}
): gsap.core.Timeline | null {
  if (!container) return null;

  const {
    count = 24,
    colors = SPARK_COLORS,
    originX = container.clientWidth / 2,
    originY = container.clientHeight / 2,
    minVelocity = 300,
    maxVelocity = 600,
    gravity = 800,
    angleMin = 0,
    angleMax = 360,
    sizeMin = 6,
    sizeMax = 12,
    duration = 1.3,
    mixedShapes = true,
    onComplete,
  } = options;

  const nodes: HTMLSpanElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    const size = gsap.utils.random(sizeMin, sizeMax, 1);
    const isCircle = mixedShapes ? i % 2 === 0 : true;
    el.style.cssText = `position:absolute;left:${originX}px;top:${originY}px;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:${isCircle ? '50%' : '2px'};pointer-events:none;will-change:transform,opacity;z-index:50;`;
    container.appendChild(el);
    nodes.push(el);
  }

  const tl = gsap.timeline({
    onComplete: () => {
      for (const n of nodes) n.remove();
      onComplete?.();
    },
  });

  tl.to(nodes, {
    duration,
    opacity: 0,
    rotation: () => gsap.utils.random(-720, 720),
    ease: 'none',
    physics2D: {
      velocity: () => gsap.utils.random(minVelocity, maxVelocity),
      angle: () => gsap.utils.random(angleMin, angleMax),
      gravity,
    },
    stagger: { each: 0.01, from: 'center' },
  });

  return tl;
}
