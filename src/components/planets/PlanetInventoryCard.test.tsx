// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanetInventoryCard } from './PlanetInventoryCard';

vi.mock('./PlanetThumbnail', () => ({ PlanetThumbnail: () => <span>Pixel preview</span> }));

const preview = {
  descriptor: {
    input: { ticketId: 24n, drawingId: 218n },
    traits: { name: 'Kepler', type: 'Gaia', minerals: 24 },
  },
  visual: { input: { ticketId: 24n } },
} as unknown as PlanetPreview;

describe('PlanetInventoryCard', () => {
  afterEach(cleanup);

  it('shows revealed planet identity and mining data', () => {
    render(<PlanetInventoryCard preview={preview} revealed drawingStatus="settled" selected={false} onSelect={vi.fn()} />);

    expect(screen.getByText('Kepler')).toBeInTheDocument();
    expect(screen.getByText('Gaia')).toBeInTheDocument();
    expect(screen.getByText('24 minerals/day')).toBeInTheDocument();
    expect(screen.getByText('DRAWING SETTLED')).toBeInTheDocument();
  });

  it('keeps unrevealed traits private and exposes only status plus mint action', () => {
    render(<PlanetInventoryCard preview={preview} revealed={false} drawingStatus="active" selected={false} onSelect={vi.fn()} mintAction={<button type="button">Mint</button>} />);

    expect(screen.queryByText('Kepler')).not.toBeInTheDocument();
    expect(screen.queryByText('Gaia')).not.toBeInTheDocument();
    expect(screen.queryByText('24 minerals/day')).not.toBeInTheDocument();
    expect(screen.getByText('DRAWING ACTIVE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mint' })).toBeInTheDocument();
  });
});
