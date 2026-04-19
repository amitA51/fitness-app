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

// Map of icon name strings to Lucide icon components
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
  // Emoji fallbacks - map common emojis to icons
  '💪': Dumbbell,
  '🏋️': Dumbbell,
  '🔥': Flame,
  '⚡': Zap,
  '🎯': Target,
  '🏆': Trophy,
  '⏱️': Timer,
  '❤️': Heart,
  '📊': BarChart3,
  '📈': TrendingUp,
};

/**
 * Get an icon component by name
 * Falls back to Dumbbell if icon not found
 */
export const getIconForName = (name: string): LucideIcon => {
  return ICON_MAP[name] || Dumbbell;
};

export default ICON_MAP;
