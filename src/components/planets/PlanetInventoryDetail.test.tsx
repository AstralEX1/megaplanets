// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PlanetPreview } from '@megaplanets/planet-generator';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEGAPLANETS_CONTRACT_ADDRESS } from '@/config/contracts';
import { PlanetInventoryDetail } from './PlanetInventoryDetail';

vi.mock('./PlanetGif', () => ({ PlanetGif: () => <span>Animated planet GIF</span> }));

const preview = {
  descriptor: {
    input: { ticketId: 24n, drawingId: 218n, normals: [4, 11, 17, 26, 39], bonusBall: 66, originTxHash: `0x${'1'.repeat(64)}` },
    traits: { name: 'Kepler', type: 'Gaia', terrain: 'pixel-continents', rarity: 'Epic', minerals: 24, satelliteCount: 1, hasRing: false },
    seed: '0x1234',
    traitsHash: '0x5678',
  },
  visual: { input: { ticketId: 24n }, traits: { hasClouds: true } },
} as unknown as PlanetPreview;

describe('PlanetInventoryDetail', () => {
  afterEach(cleanup);

  it('shows revealed planet details with ticket provenance under either V2 env state', () => {
    const onClaim = vi.fn();
    const { container } = render(<PlanetInventoryDetail preview={preview} tokenId="7" ticketTxHash={`0x${'1'.repeat(64)}`} revealed mining={{ tokenId: '7', baseMineralsPerDay: '24', effectiveMineralsPerDayMicros: '25200000', earnedMicros: '10100000', activeSince: '2026-08-10T00:00:00.000Z' }} miningAsOf="2026-08-10T00:00:01.000Z" ticketStatus={{ kind: 'claim', amount: 12_500_000n, ticketId: 24n }} mintAction={null} onClaim={onClaim} />);

    expect(screen.getByRole('heading', { name: 'Kepler' })).toBeInTheDocument();
    expect(screen.getByText('Animated planet GIF')).toBeInTheDocument();
    expect(screen.getByTestId('planet-artwork')).toContainElement(screen.getByTestId('planet-mining-overlay'));
    expect(screen.getByRole('button', { name: 'Claim ($12.50)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Details/i })).not.toBeInTheDocument();
    expect(screen.getByText('Pixel continents')).toBeInTheDocument();
    expect(screen.getByText('Yes', { selector: '[data-trait="clouds"]' })).toBeInTheDocument();
    expect(screen.getByText('Base minerals')).toBeInTheDocument();
    expect(screen.getByText('24', { selector: '[data-trait="base-minerals"]' })).toBeInTheDocument();
    expect(screen.queryByText('Rings')).not.toBeInTheDocument();
    expect(screen.getByText('66', { selector: '[data-coordinate="bonus"]' })).toBeInTheDocument();
    expect(screen.getByText('Ticket #24')).toBeInTheDocument();
    expect(screen.getByText('Planet #7')).toBeInTheDocument();
    const ticketExplorerLink = screen.getByRole('link', { name: 'Ticket BaseScan' });
    expect(ticketExplorerLink).toHaveAttribute(
      'href',
      `https://sepolia.basescan.org/tx/0x${'1'.repeat(64)}`,
    );
    expect(ticketExplorerLink).toHaveAttribute('target', '_blank');
    expect(ticketExplorerLink).toHaveAttribute('rel', 'noreferrer');
    if (MEGAPLANETS_CONTRACT_ADDRESS) {
      expect(screen.getByRole('link', { name: 'NFT BaseScan' })).toHaveAttribute(
        'href',
        `https://sepolia.basescan.org/nft/${MEGAPLANETS_CONTRACT_ADDRESS}/7`,
      );
    } else {
      expect(screen.getByText('NFT BaseScan unavailable')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'NFT BaseScan' })).not.toBeInTheDocument();
    }
    expect(container.querySelector('[data-density="compact"]')).toBeInTheDocument();

    screen.getByRole('button', { name: 'Claim ($12.50)' }).click();
    expect(onClaim).toHaveBeenCalledOnce();
  });

  it.each([
    [{ kind: 'countdown', time: '23:59:42' } as const, '23:59:42'],
    [{ kind: 'drawing' } as const, 'Drawing'],
    [{ kind: 'claimed', amount: 12_500_000n } as const, 'Claimed ($12.50)'],
    [{ kind: 'drawn' } as const, 'Drawn'],
  ])('renders %s as state without an action', (ticketStatus, label) => {
    render(<PlanetInventoryDetail preview={preview} tokenId="7" revealed ticketStatus={ticketStatus} mintAction={null} />);

    expect(document.querySelector(`[data-ticket-lifecycle="${ticketStatus.kind}"]`)).toHaveTextContent(label);
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  });

  it('shows unavailable explorer provenance without broken links', () => {
    render(<PlanetInventoryDetail preview={preview} revealed ticketStatus={{ kind: 'drawn' }} mintAction={null} />);

    expect(screen.getByText('Ticket BaseScan unavailable')).toBeInTheDocument();
    expect(screen.getByText('NFT BaseScan unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ticket BaseScan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'NFT BaseScan' })).not.toBeInTheDocument();
  });

  it('limits unrevealed detail to ticket provenance, claim state, and mint action', () => {
    render(<PlanetInventoryDetail preview={preview} ticketTxHash={`0x${'1'.repeat(64)}`} revealed={false} mining={{ tokenId: '7', baseMineralsPerDay: '24', effectiveMineralsPerDayMicros: '25200000', earnedMicros: '10100000', activeSince: '2026-08-10T00:00:00.000Z' }} miningAsOf="2026-08-10T00:00:01.000Z" ticketStatus={{ kind: 'claim', amount: 12_500_000n, ticketId: 24n }} mintAction={<button type="button">Mint</button>} />);

    expect(screen.getByText('Ticket #24')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('66', { selector: '[data-coordinate="bonus"]' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Claim ($12.50)' })).not.toBeInTheDocument();
    expect(screen.getByText(/reveal this planet before claiming/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ticket BaseScan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mint' })).toBeInTheDocument();
    expect(screen.queryByText('Kepler')).not.toBeInTheDocument();
    expect(screen.queryByText('Gaia')).not.toBeInTheDocument();
    expect(screen.queryByText('Epic')).not.toBeInTheDocument();
    expect(screen.queryByText('Pixel continents')).not.toBeInTheDocument();
    expect(screen.queryByTestId('planet-artwork')).not.toBeInTheDocument();
    expect(screen.queryByTestId('planet-mining-overlay')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'NFT BaseScan' })).not.toBeInTheDocument();
    expect(screen.queryByText(/same type/i)).not.toBeInTheDocument();
  });

  it('guards an unrevealed winning ticket from burning itself through claim', () => {
    render(<PlanetInventoryDetail preview={preview} ticketTxHash={`0x${'1'.repeat(64)}`} revealed={false} ticketStatus={{ kind: 'claim', amount: 12_500_000n, ticketId: 24n }} mintAction={<button type="button">Mint</button>} />);

    expect(screen.queryByRole('button', { name: 'Claim ($12.50)' })).not.toBeInTheDocument();
    expect(screen.getByText(/reveal this planet before claiming/i)).toBeInTheDocument();
  });
});
