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
    traits: { name: 'Kepler', type: 'Gaia', rarity: 'Epic', minerals: 24 },
  },
  visual: { input: { ticketId: 24n } },
} as unknown as PlanetPreview;

describe('PlanetInventoryCard', () => {
  afterEach(cleanup);

  it('shows revealed planet identity and mining data', () => {
    render(<PlanetInventoryCard preview={preview} tokenId="7" revealed effectiveMineralsPerDayMicros="25200000" ticketStatus={{ kind: 'drawn' }} selected={false} onSelect={vi.fn()} />);

    expect(screen.getByText('Kepler')).toBeInTheDocument();
    expect(screen.getByText('Planet #7')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Minerals' })).toBeInTheDocument();
    expect(screen.getByText('25.2')).toBeInTheDocument();
    expect(screen.queryByText(/minerals\/day/i)).not.toBeInTheDocument();
    expect(screen.getByText('Drawn')).toBeInTheDocument();
    expect(screen.queryByText('Epic')).not.toBeInTheDocument();
    const card = screen.getByRole('button', { name: 'Select Kepler' }).closest('article');
    expect(card).toHaveClass('border-violet-400', 'border-[3px]', 'shadow-[0_18px_42px_rgba(0,0,0,0.52)]');
  });

  it('adds a separate selected state without replacing the rarity border', () => {
    render(<PlanetInventoryCard preview={preview} tokenId="7" revealed ticketStatus={{ kind: 'drawn' }} selected onSelect={vi.fn()} />);

    const card = screen.getByRole('button', { name: 'Select Kepler' }).closest('article');
    expect(card).toHaveClass('border-violet-400');
    expect(card).toHaveAttribute('data-selected', 'true');
    expect(card).toHaveAttribute('data-rarity', 'Epic');
    expect(screen.getByText('Selected')).toBeInTheDocument();
  });

  it('keeps unrevealed traits private and exposes a selectable ticket plus separate mint action', () => {
    const onSelect = vi.fn();
    render(<PlanetInventoryCard preview={preview} revealed={false} ticketStatus={{ kind: 'drawing' }} selected={false} onSelect={onSelect} mintAction={<button type="button">Mint</button>} />);

    expect(screen.queryByText('Kepler')).not.toBeInTheDocument();
    expect(screen.queryByText('Gaia')).not.toBeInTheDocument();
    expect(screen.queryByText(/minerals/i)).not.toBeInTheDocument();
    expect(screen.getByText('Drawing')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Select unrevealed Ticket #24' }).click();
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Mint' })).toBeInTheDocument();
  });
});
