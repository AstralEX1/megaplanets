import { derivePlanetPreview, type PlanetPreview } from '@megaplanets/planet-generator';
import { useCallback, useMemo, useState } from 'react';
import { PlanetGif } from '@/components/planets/PlanetGif';
import { PLANET_CONFIG } from '@/config/planetConfig';
import { LandingSplitText } from './LandingSplitText';

const PREVIEW_ORIGIN_TX_HASH = `0x${'51'.repeat(32)}` as `0x${string}`;
const INITIAL_TICKET_NUMBER = 5001;

function createPreview(ticketNumber: number): PlanetPreview {
  const normalStart = (ticketNumber * 13) % 255;
  const normals = Array.from(
    { length: 5 },
    (_, index) => ((normalStart + index * 31) % 255) + 1,
  );

  return derivePlanetPreview(
    {
      ticketId: BigInt(ticketNumber),
      drawingId: BigInt(700 + (ticketNumber % 5)),
      normals,
      bonusBall: ((ticketNumber * 17) % 255) + 1,
      originTxHash: PREVIEW_ORIGIN_TX_HASH,
    },
    PLANET_CONFIG,
  );
}

export function PlanetGeneratorHero() {
  const [ticketNumber, setTicketNumber] = useState(INITIAL_TICKET_NUMBER);
  const preview = useMemo(() => createPreview(ticketNumber), [ticketNumber]);
  const generatePlanet = useCallback(() => setTicketNumber((current) => current + 1), []);

  return (
    <article className="landing-live-generator" aria-label="Generated Planet preview">
      <div className="landing-live-generator-art">
        <PlanetGif preview={preview} deferGeneration />
      </div>
      <button className="landing-live-generator-button" type="button" onClick={generatePlanet}>
        <LandingSplitText text="Generate planet" className="landing-button-label" />
      </button>
    </article>
  );
}
