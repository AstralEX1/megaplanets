// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanetInventoryDetail } from './PlanetInventoryDetail';

vi.mock('./PlanetGif', () => ({ PlanetGif: () => <span>Animated planet GIF</span> }));

const preview = {
  descriptor: {
    input: { ticketId: 24n, drawingId: 218n, normals: [4, 11, 17, 26, 39], bonusBall: 66 },
    traits: { name: 'Kepler', type: 'Gaia', terrain: 'pixel-continents', rarity: 'Epic', minerals: 24, satelliteCount: 1, hasRing: false },
    seed: '0x1234',
    traitsHash: '0x5678',
  },
  visual: { input: { ticketId: 24n }, traits: { hasClouds: true } },
} as unknown as PlanetPreview;

describe('PlanetInventoryDetail', () => {
  afterEach(cleanup);

  it('shows full traits only after a planet is revealed', () => {
    const onStatusAction = vi.fn();
    const onViewDetails = vi.fn();
    const { container } = render(<PlanetInventoryDetail preview={preview} tokenId="7" revealed mining={{ tokenId: '7', baseMineralsPerDay: '24', multiplierBps: '10500', effectiveMineralsPerDayMicros: '25200000', pendingMicros: '1000000', earnedMicros: '10100000', activeSince: '2026-08-10T00:00:00.000Z' }} miningAsOf="2026-08-10T00:00:01.000Z" ticketStatus={{ kind: 'claim', amount: 12_500_000n, ticketId: 24n }} mintAction={null} onStatusAction={onStatusAction} onViewDetails={onViewDetails} />);

    expect(screen.getByRole('heading', { name: 'Kepler' })).toBeInTheDocument();
    expect(screen.getByText('Animated planet GIF')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Minerals' })).toBeInTheDocument();
    expect(screen.queryByText(/minerals\/day/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Mined 10\.1/)).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Same-Type bonus +5%')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Effective rate 25.2 / day')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim ($12.50)' })).toBeInTheDocument();
    expect(screen.getByText('Pixel continents')).toBeInTheDocument();
    expect(screen.getByText('Yes', { selector: '[data-trait="clouds"]' })).toBeInTheDocument();
    expect(screen.getByText('No', { selector: '[data-trait="rings"]' })).toBeInTheDocument();
    expect(screen.getByText('66', { selector: '[data-coordinate="bonus"]' })).toBeInTheDocument();
    expect(screen.getByText('Ticket #24')).toBeInTheDocument();
    expect(screen.getByText('Planet #7')).toBeInTheDocument();
    expect(container.querySelector('[data-density="compact"]')).toBeInTheDocument();
    expect(container.querySelector('[data-planet-art]')).toHaveClass('max-h-[32vh]');

    screen.getByRole('button', { name: 'Claim ($12.50)' }).click();
    screen.getByRole('button', { name: 'View details' }).click();
    expect(onStatusAction).toHaveBeenCalledOnce();
    expect(onViewDetails).toHaveBeenCalledOnce();
  });

  it('limits unrevealed detail to ticket status, purchased coordinates, and mint action', () => {
    render(<PlanetInventoryDetail preview={preview} revealed={false} ticketStatus={{ kind: 'countdown', time: '23:59:42' }} mintAction={<button type="button">Mint</button>} />);

    expect(screen.queryByText('Kepler')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Clock' })).toBeInTheDocument();
    expect(screen.getByText('23:59:42')).toBeInTheDocument();
    expect(screen.queryByText(/waiting/i)).not.toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('66', { selector: '[data-coordinate="bonus"]' })).toBeInTheDocument();
    expect(screen.getByText('Ticket #24')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mint' })).toBeInTheDocument();
  });
});
