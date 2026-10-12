import {
  Activity,
  Bike,
  Footprints,
  type LucideIcon,
  Mountain,
  PersonStanding,
  Sailboat,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react';
import { memo } from 'react';
import type { CardioActivity } from '../../types';

const ICONS: Record<CardioActivity, LucideIcon> = {
  run: Footprints,
  treadmill: Footprints,
  walk: PersonStanding,
  hike: Mountain,
  cycle: Bike,
  indoor_cycle: Bike,
  row: Sailboat,
  elliptical: Activity,
  stairs: TrendingUp,
  swim: Waves,
  jump_rope: Zap,
  hiit: Zap,
  other: Activity,
};

interface ActivityIconProps {
  activity: CardioActivity;
  size?: number;
}

/** Lucide glyph of a cardio activity. Decorative — the label carries meaning. */
export const ActivityIcon = memo(function ActivityIcon({ activity, size = 22 }: ActivityIconProps) {
  const Icon = ICONS[activity] ?? Activity;
  return <Icon size={size} aria-hidden="true" />;
});
