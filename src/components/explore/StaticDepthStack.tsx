import unrevealedPlanet from '@/assets/unrevealed-planet.png';
import { OrbitImages } from './OrbitImages';

const MAX_VISIBLE_PLANETS = 50;

/**
 * Static presentation adaptation of the supplied React Bits DepthCarousel.
 * Planet cards deliberately do not accept navigation, drag, wheel, or autoplay input.
 */
export function StaticDepthStack({
  quantity,
  maxVisiblePlanets = MAX_VISIBLE_PLANETS,
}: {
  quantity: number;
  maxVisiblePlanets?: number;
}) {
  const capacity = Math.max(1, Math.floor(maxVisiblePlanets));
  const visibleCards = Math.min(Math.max(quantity, 0), capacity);
  const images = Array.from({ length: visibleCards }, () => unrevealedPlanet);
  const itemSize = visibleCards === 1 ? 560 : Math.max(180, 620 - (visibleCards - 1) * 55);
  const radiusX = visibleCards === 1 ? 1 : Math.min(620, Math.max(120, 700 - itemSize / 2 - 20));
  const radiusY = visibleCards === 1 ? 1 : Math.min(130, Math.max(60, 44 + visibleCards * 4));
  const visualHeight = 350;

  return (
    <fieldset
      className="relative m-0 flex w-full min-w-0 items-center justify-center overflow-hidden border-0 p-0"
      style={{ height: `${visualHeight}px` }}
      aria-label="Selected planets visualization"
    >
      <OrbitImages
        images={images}
        altPrefix="Selected planet"
        className="absolute inset-0 translate-y-8"
        shape="ellipse"
        radiusX={radiusX}
        radiusY={radiusY}
        rotation={-16}
        duration={35}
        itemSize={itemSize}
        height={visualHeight}
        responsive
      />
    </fieldset>
  );
}
