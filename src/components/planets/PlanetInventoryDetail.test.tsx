// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanetInventoryDetail } from './PlanetInventoryDetail';

vi.mock('./PlanetThumbnail', () => ({ PlanetThumbnail: () => <span>Pixel preview</span> }));

const preview = {
  descriptor: {
    input: { ticketId: 24n, drawingId: 218n, normals: [4, 11, 17, 26, 39], bonusBall: 66 },
    traits: { name: 'Kepler', type: 'Gaia', rarity: 'Epic', minerals: 24, satelliteCount: 1, hasRing: false },
    seed: '0x1234',
    traitsHash: '0x5678',
  },
  visual: { input: { ticketId: 24n } },
} as unknown as PlanetPreview;

describe('PlanetInventoryDetail', () => {
  afterEach(cleanup);

  it('shows full traits only after a planet is revealed', () => {
    render(<PlanetInventoryDetail preview={preview} revealed drawingStatus="settled" mintAction={null} />);

    expect(screen.getByRole('heading', { name: 'Kepler' })).toBeInTheDocument();
    expect(screen.getByText('24 minerals/day')).toBeInTheDocument();
    expect(screen.getByText(/4.*11.*17.*26.*39.*66/)).toBeInTheDocument();
  });

  it('limits unrevealed detail to drawing status and mint action', () => {
    render(<PlanetInventoryDetail preview={preview} revealed={false} drawingStatus="active" mintAction={<button type="button">Mint</button>} />);

    expect(screen.queryByText('Kepler')).not.toBeInTheDocument();
    expect(screen.getByText('DRAWING ACTIVE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mint' })).toBeInTheDocument();
  });
});
