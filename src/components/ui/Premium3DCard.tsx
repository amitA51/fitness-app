// Premium3DCard — DEPRECATED thin wrapper around the canonical <Card>.
// The former mouse-tracked 3D tilt/glare was removed during card consolidation;
// this now renders a floating, interactive Card so existing imports + the
// onClick/className contract keep working. New code should use `<Card>`.

import type React from 'react';
import { Card } from './Card';

interface Premium3DCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  /** @deprecated 3D tilt removed; ignored. */
  depth?: number;
  /** @deprecated specular glare removed; ignored. */
  glareColor?: string;
}

/** @deprecated Use `<Card variant="floating" interactive>` from `components/ui/Card`. */
export const Premium3DCard: React.FC<Premium3DCardProps> = ({
  children,
  className = '',
  onClick,
  depth: _depth,
  glareColor: _glareColor,
}) => (
  <Card variant="floating" interactive asymmetric noPadding onClick={onClick} className={className}>
    {children}
  </Card>
);

export default Premium3DCard;
