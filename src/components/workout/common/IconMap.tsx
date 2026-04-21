// Icon Map - Maps icon names to Lucide React icons
import {
  Activity,
  BarChart3,
  Bike,
  Calendar,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  type LucideIcon,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Waves,
  Weight,
  Zap,
} from 'lucide-react';

// Map of icon name strings to Lucide icon components.
// Legacy emoji-keyed entries are preserved for backward-compatible lookups
// on any persisted data that used emoji glyphs — keys are declared via
// unicode escapes so source code stays emoji-free.
const ICON_MAP: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  flame: Flame,
  zap: Zap,
  target: Target,
  trophy: Trophy,
  timer: Timer,
  heart: Heart,
  activity: Activity,
  'bar-chart': BarChart3,
  calendar: Calendar,
  clock: Clock,
  'trending-up': TrendingUp,
  weight: Weight,
  footprints: Footprints,
  bike: Bike,
  waves: Waves,
  // Legacy pictographic keys (unicode-escaped: flexed biceps, weight lifter,
  // fire, high voltage, direct hit, trophy, stopwatch, red heart, bar chart,
  // chart increasing).
  '\u{1F4AA}': Dumbbell,
  '\u{1F3CB}\u{FE0F}': Dumbbell,
  '\u{1F525}': Flame,
  '\u{26A1}': Zap,
  '\u{1F3AF}': Target,
  '\u{1F3C6}': Trophy,
  '\u{23F1}\u{FE0F}': Timer,
  '\u{2764}\u{FE0F}': Heart,
  '\u{1F4CA}': BarChart3,
  '\u{1F4C8}': TrendingUp,
};

/**
 * Get an icon component by name
 * Falls back to Dumbbell if icon not found
 */
export const getIconForName = (name: string): LucideIcon => {
  return ICON_MAP[name] || Dumbbell;
};

export default ICON_MAP;
