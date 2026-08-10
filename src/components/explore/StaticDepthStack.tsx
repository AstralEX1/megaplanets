import unrevealedPlanet from '@/assets/unrevealed-planet.png';

const MAX_VISIBLE_CARDS = 5;

/**
 * Static presentation adaptation of the supplied React Bits DepthCarousel.
 * Planet cards deliberately do not accept navigation, drag, wheel, or autoplay input.
 */
export function StaticDepthStack({ quantity }: { quantity: number }) {
  const visibleCards = Math.min(quantity, MAX_VISIBLE_CARDS);
  const cards = Array.from({ length: visibleCards }, (_, index) => ({ id: `planet-${index + 1}`, index }));

  return (
    <fieldset className="m-0 flex h-[260px] w-full min-w-0 items-center justify-center overflow-hidden border-0 p-0" aria-label="Selected planets visualization">
      <div className="relative h-[220px] w-[340px] [perspective:900px]">
        {cards.map(({ id, index }) => {
          const depth = visibleCards - index - 1;
          const scale = 1 - depth * 0.08;
          const translateX = depth * 26;
          const translateY = depth * 5;
          const rotation = depth * 7;
          const brightness = 1 - depth * 0.13;

          return (
            <div
              key={id}
              className="absolute left-1/2 top-1/2 h-[186px] w-[186px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-[color:color-mix(in_srgb,var(--rare)_70%,transparent)] bg-[var(--surface-raised)] shadow-[0_20px_44px_rgba(0,0,0,0.42)]"
              style={{
                filter: `brightness(${brightness})`,
                opacity: 1 - depth * 0.12,
                transform: `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) translateZ(${-depth * 80}px) rotateY(${-rotation}deg) scale(${scale})`,
                zIndex: MAX_VISIBLE_CARDS - depth,
              }}
            >
              <img className="h-full w-full scale-[1.03] object-cover" src={unrevealedPlanet} alt={`Selected planet ${index + 1} of ${quantity}`} draggable={false} />
            </div>
          );
        })}
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--background)_86%,transparent)] px-3 py-1 font-hud text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
        {quantity} {quantity === 1 ? 'planet' : 'planets'} selected
      </div>
    </fieldset>
  );
}
