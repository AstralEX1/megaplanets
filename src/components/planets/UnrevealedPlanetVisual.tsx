import unrevealedPlanet from '@/assets/unrevealed-planet.png';

/** Shared artwork for planets whose deterministic traits are still private. */
export function UnrevealedPlanetVisual({ label, className = '' }: { label: string; className?: string }) {
  return <img className={`block object-cover ${className}`} src={unrevealedPlanet} alt={label} aria-label={label} draggable={false} />;
}
