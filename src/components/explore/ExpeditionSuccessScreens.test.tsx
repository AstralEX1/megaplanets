// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/planets/PlanetThumbnail', () => ({
  PlanetThumbnail: ({ descriptor }: { descriptor: { input: { ticketId: bigint } } }) => <span>Preview {descriptor.input.ticketId.toString()}</span>,
}));

import { ExpeditionCompleteScreen, RevealCompleteScreen } from './ExpeditionSuccessScreens';

const previews = [
  { descriptor: { input: { ticketId: 34n }, traits: { name: 'Astraea', type: 'Nebula', rarity: 'Rare', minerals: 34 } }, visual: { input: { ticketId: 34n } } },
  { descriptor: { input: { ticketId: 24n }, traits: { name: 'Kepler', type: 'Gaia', rarity: 'Epic', minerals: 24 } }, visual: { input: { ticketId: 24n } } },
  { descriptor: { input: { ticketId: 18n }, traits: { name: 'Vulcan', type: 'Volcanic', rarity: 'Common', minerals: 18 } }, visual: { input: { ticketId: 18n } } },
] as unknown as readonly PlanetPreview[];

describe('Expedition success screens', () => {
  afterEach(cleanup);

  it('renders the confirmed ticket screen with the supplied reveal action', () => {
    render(<ExpeditionCompleteScreen count={3} revealAction={<button type="button">REVEAL (3)</button>} />);

    expect(screen.getByText('EXPEDITION COMPLETE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'You found 3 planets!' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/unrevealed ticket/i)).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'REVEAL (3)' })).toBeInTheDocument();
  });

  it('renders revealed NFT cards and keeps Claim presentational', () => {
    render(<RevealCompleteScreen planets={previews} drawingId={218n} onViewPlanets={vi.fn()} />);

    expect(screen.getByText('REVEAL COMPLETE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your new planets are ready.' })).toBeInTheDocument();
    expect(screen.getByText('Drawing #218 · Season 01')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /revealed planet/i })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Claim' })).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'My planets' })).toBeInTheDocument();
  });
});
