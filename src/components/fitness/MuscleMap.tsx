// ============================================================================
// MuscleMap — front + back body diagram highlighting the muscles an exercise
// works. Fresh, dependency-free SVG built from this app's own muscle taxonomy
// (see muscleMapData.ts). Inspired by the muscle diagrams common to fitness
// apps; authored from scratch (no third-party code/assets, zero license risk).
//
// Fresh Steel / Obsidian: tokenized for light + dark. Primary muscles fill with
// the mint accent, secondary muscles with a softened accent, the rest of the
// body reads as a faint --fs-surface-2 silhouette. role="img" + a Hebrew
// aria-label carries the worked-muscle list for screen readers.
// ============================================================================

import { translateMuscle } from '../../constants/muscleNames';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { type MuscleRegion, regionsForMuscles } from './muscleMapData';

type Ellipse = { t: 'e'; cx: number; cy: number; rx: number; ry: number };
type Rect = { t: 'r'; x: number; y: number; w: number; h: number; rx?: number };
type Shape = (Ellipse | Rect) & { region: MuscleRegion | null };

// Stylized anatomy, viewBox 0 0 100 250, body centred on x=50. region:null is
// decorative (head/neck/pelvis) and always reads as the faint silhouette.
const FRONT: Shape[] = [
  { region: null, t: 'e', cx: 50, cy: 21, rx: 12, ry: 13 }, // head
  { region: null, t: 'r', x: 45, y: 31, w: 10, h: 8 }, // neck
  { region: 'shoulders', t: 'e', cx: 31, cy: 50, rx: 11, ry: 9 },
  { region: 'shoulders', t: 'e', cx: 69, cy: 50, rx: 11, ry: 9 },
  { region: 'chest', t: 'e', cx: 41, cy: 64, rx: 12, ry: 9 },
  { region: 'chest', t: 'e', cx: 59, cy: 64, rx: 12, ry: 9 },
  { region: 'biceps', t: 'e', cx: 22, cy: 74, rx: 7, ry: 15 },
  { region: 'biceps', t: 'e', cx: 78, cy: 74, rx: 7, ry: 15 },
  { region: 'forearms', t: 'e', cx: 17, cy: 104, rx: 6, ry: 16 },
  { region: 'forearms', t: 'e', cx: 83, cy: 104, rx: 6, ry: 16 },
  { region: 'abs', t: 'r', x: 41, y: 76, w: 18, h: 30, rx: 5 },
  { region: 'obliques', t: 'e', cx: 35, cy: 90, rx: 4, ry: 13 },
  { region: 'obliques', t: 'e', cx: 65, cy: 90, rx: 4, ry: 13 },
  { region: null, t: 'r', x: 39, y: 114, w: 22, h: 22, rx: 6 }, // pelvis
  { region: 'quads', t: 'e', cx: 40, cy: 162, rx: 10, ry: 30 },
  { region: 'quads', t: 'e', cx: 60, cy: 162, rx: 10, ry: 30 },
  { region: 'calves', t: 'e', cx: 41, cy: 214, rx: 8, ry: 22 },
  { region: 'calves', t: 'e', cx: 59, cy: 214, rx: 8, ry: 22 },
];

const BACK: Shape[] = [
  { region: null, t: 'e', cx: 50, cy: 21, rx: 12, ry: 13 }, // head
  { region: null, t: 'r', x: 45, y: 31, w: 10, h: 8 }, // neck
  { region: 'traps', t: 'e', cx: 50, cy: 47, rx: 17, ry: 9 },
  { region: 'lats', t: 'e', cx: 41, cy: 68, rx: 11, ry: 15 },
  { region: 'lats', t: 'e', cx: 59, cy: 68, rx: 11, ry: 15 },
  { region: 'lowerback', t: 'r', x: 42, y: 88, w: 16, h: 18, rx: 4 },
  { region: 'triceps', t: 'e', cx: 22, cy: 74, rx: 7, ry: 15 },
  { region: 'triceps', t: 'e', cx: 78, cy: 74, rx: 7, ry: 15 },
  { region: 'forearms', t: 'e', cx: 17, cy: 104, rx: 6, ry: 16 },
  { region: 'forearms', t: 'e', cx: 83, cy: 104, rx: 6, ry: 16 },
  { region: 'glutes', t: 'e', cx: 41, cy: 128, rx: 11, ry: 11 },
  { region: 'glutes', t: 'e', cx: 59, cy: 128, rx: 11, ry: 11 },
  { region: 'hamstrings', t: 'e', cx: 40, cy: 168, rx: 10, ry: 27 },
  { region: 'hamstrings', t: 'e', cx: 60, cy: 168, rx: 10, ry: 27 },
  { region: 'calves', t: 'e', cx: 41, cy: 216, rx: 8, ry: 22 },
  { region: 'calves', t: 'e', cx: 59, cy: 216, rx: 8, ry: 22 },
];

function fillFor(
  region: MuscleRegion | null,
  primary: Set<MuscleRegion>,
  secondary: Set<MuscleRegion>
): string {
  if (region && primary.has(region)) return 'var(--fs-accent)';
  if (region && secondary.has(region)) {
    return 'color-mix(in srgb, var(--fs-accent) 42%, var(--fs-surface-2))';
  }
  return 'var(--fs-surface-2)';
}

function BodyView({
  shapes,
  primary,
  secondary,
  caption,
  reduced,
}: {
  shapes: Shape[];
  primary: Set<MuscleRegion>;
  secondary: Set<MuscleRegion>;
  caption: string;
  reduced: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg
        viewBox="0 0 100 250"
        width="78"
        height="auto"
        aria-hidden="true"
        style={{ display: 'block', maxWidth: '100%' }}
      >
        <title>{caption}</title>
        {shapes.map((s, i) => {
          const fill = fillFor(s.region, primary, secondary);
          const common = {
            fill,
            style: reduced ? undefined : { transition: 'fill 220ms var(--ease-out)' },
          };
          return s.t === 'e' ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable shape list
            <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable shape list
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx ?? 0} {...common} />
          );
        })}
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--fs-muted)',
        }}
      >
        {caption}
      </span>
    </div>
  );
}

export interface MuscleMapProps {
  /** Primary muscles (English catalog keys or Hebrew labels) — filled in accent. */
  primary?: ReadonlyArray<string | undefined | null>;
  /** Secondary muscles — filled in a softened accent. */
  secondary?: ReadonlyArray<string | undefined | null>;
  className?: string;
}

/**
 * Body diagram of the muscles an exercise works. Pass `primary`/`secondary`
 * muscle keys (the same values exercises already carry); the map resolves them
 * to body regions and highlights front + back accordingly.
 */
export function MuscleMap({ primary = [], secondary = [], className }: MuscleMapProps) {
  const reduced = useReducedMotion();

  // Cheap pure derivations (tiny arrays) — recomputed per render, no memo needed.
  const primaryRegions = regionsForMuscles(primary);
  const secondaryRegions = regionsForMuscles(secondary);
  for (const r of primaryRegions) secondaryRegions.delete(r); // primary wins over secondary

  // Screen-reader label: unique Hebrew muscle names (primary first, secondary after).
  const names = new Set<string>();
  for (const m of primary) {
    const he = translateMuscle(m ?? undefined);
    if (he && he !== 'אחר') names.add(he);
  }
  for (const m of secondary) {
    const he = translateMuscle(m ?? undefined);
    if (he && he !== 'אחר') names.add(he);
  }
  const ariaLabel =
    names.size > 0 ? `שרירים בעבודה: ${[...names].join(', ')}` : 'מפת שרירים';

  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel}
      dir="rtl"
      style={{ display: 'flex', justifyContent: 'center', gap: 20 }}
    >
      <BodyView
        shapes={FRONT}
        primary={primaryRegions}
        secondary={secondaryRegions}
        caption="חזית"
        reduced={reduced}
      />
      <BodyView
        shapes={BACK}
        primary={primaryRegions}
        secondary={secondaryRegions}
        caption="גב"
        reduced={reduced}
      />
    </div>
  );
}

export default MuscleMap;
