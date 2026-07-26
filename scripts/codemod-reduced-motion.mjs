// One-off codemod: point every `useReducedMotion` consumer at the shared hook
// (src/hooks/useReducedMotion.ts) instead of Framer's OS-only version, so the
// in-app "הפחתת אנימציות" setting actually suppresses Framer animations.
// Run with: node scripts/codemod-reduced-motion.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const files = [
  'src/AppRouter.tsx',
  'src/components/ui/AnimatedProgressRing.tsx',
  'src/components/ui/GlobalToast.tsx',
  'src/components/ui/LoadingSpinner.tsx',
  'src/components/workout/components/ExerciseCard.tsx',
  'src/components/workout/components/IntensityMeter.tsx',
  'src/components/workout/components/PerformanceAnalytics.tsx',
  'src/components/workout/components/ProgressBar.tsx',
  'src/components/workout/components/SetInputCard.tsx',
  'src/components/workout/ExerciseSelector/index.tsx',
  'src/components/workout/overlays/NumpadOverlay.tsx',
  'src/components/workout/WarmupCooldownFlow.tsx',
  'src/pages/Nutrition.tsx',
  'src/pages/Program.tsx',
  'src/pages/settings/components/SavedIndicator.tsx',
  'src/pages/WorkoutDetail.tsx',
];

const hookAbs = path.resolve('src/hooks/useReducedMotion');

for (const rel of files) {
  const abs = path.resolve(rel);
  let source = readFileSync(abs, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';

  const importRe = /^import \{([^}]*)\} from 'framer-motion';$/m;
  const match = source.match(importRe);
  if (!match) {
    console.warn(`skip (no framer import): ${rel}`);
    continue;
  }

  const specifiers = match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const remaining = specifiers.filter((s) => s !== 'useReducedMotion');
  if (remaining.length === specifiers.length) {
    console.warn(`skip (no useReducedMotion): ${rel}`);
    continue;
  }

  let hookPath = path.relative(path.dirname(abs), hookAbs).split(path.sep).join('/');
  if (!hookPath.startsWith('.')) hookPath = `./${hookPath}`;

  const replacement =
    remaining.length > 0
      ? `import { ${remaining.join(', ')} } from 'framer-motion';${eol}import { useReducedMotion } from '${hookPath}';`
      : `import { useReducedMotion } from '${hookPath}';`;

  source = source.replace(importRe, replacement);
  writeFileSync(abs, source);
  console.log(`rewrote ${rel} -> ${hookPath}`);
}
