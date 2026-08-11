import { useState } from 'react';
import { randomMysteryPlanet } from '@/assets/mystery-planets';

/** Shared artwork for planets whose deterministic traits are still private. */
export function UnrevealedPlanetVisual({ label, className = '' }: { label: string; className?: string }) {
  const [image] = useState(() => randomMysteryPlanet());

  return <img className={`block object-cover ${className}`} src={image} alt={label} aria-label={label} draggable={false} />;
}
