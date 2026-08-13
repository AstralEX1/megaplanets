// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Landing } from './Landing';

vi.mock('@/hooks/useJackpotState', () => ({
  useJackpotState: () => ({
    phase: 'open',
    drawingId: 88n,
    state: undefined,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

describe('Landing', () => {
  afterEach(cleanup);

  it('presents the Megastera planet-first message without the app wallet shell', () => {
    render(<Landing />);

    expect(screen.getByRole('heading', { name: /Explore Planets\.\s*Win prizes\./ })).toBeInTheDocument();
    expect(screen.getByText('Every ticket becomes a Planet and enters the draw.')).toBeInTheDocument();
    expect(screen.getByText('powered by Megapot')).toBeInTheDocument();
    expect(screen.queryByText(/connect wallet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/MegaPlanets/i)).not.toBeInTheDocument();
  });

  it('sends every Play CTA to the play experience', () => {
    const { container } = render(<Landing />);

    const ctas = screen.getAllByRole('link', { name: 'Play' });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    expect(ctas.every((cta) => cta.getAttribute('href') === '/play')).toBe(true);
    expect(screen.queryByText('Mint Planet')).not.toBeInTheDocument();
    expect([...container.querySelectorAll('img')].every((image) => image.closest('.landing-planet-card'))).toBe(true);
  });

  it('explains the two linked mechanics in one compact block', () => {
    const { container } = render(<Landing />);
    const landing = within(container);

    expect(container.querySelectorAll('.landing > main > section')).toHaveLength(3);
    expect(landing.getByRole('region', { name: /One ticket\.\s*One Planet\./ })).toBeInTheDocument();
    expect(landing.getByRole('heading', { name: /One ticket\.\s*One Planet\./ })).toBeInTheDocument();
    expect(landing.getByRole('heading', { name: 'Megapot Ticket' })).toBeInTheDocument();
    expect(landing.getByRole('heading', { name: 'Planet' })).toBeInTheDocument();
    expect(landing.getByText(/enters the Megapot draw and can win the jackpot/i)).toBeInTheDocument();
    expect(landing.getByText(/tied to that ticket, mines minerals and competes on the leaderboard/i)).toBeInTheDocument();
    expect(container.querySelector('.landing-mechanics-connection')).toHaveTextContent(/ONE TICKET\s*→\s*ONE PLANET/);
    expect(landing.queryByText('PLANET = TICKET')).not.toBeInTheDocument();
    expect(landing.queryByText('MEGAPOT · IN DRAW')).not.toBeInTheDocument();
    expect(container.querySelector('.landing-live-generator-button')).toBeInTheDocument();
    expect(container.querySelector('.landing-megapot-ticket')).toBeInTheDocument();
    expect(container.querySelectorAll('.landing-ticket-ball')).toHaveLength(6);
    expect(container.querySelectorAll('.landing-ticket-ball-bonus')).toHaveLength(1);
    expect(container.querySelectorAll('.landing-my-planet-card')).toHaveLength(3);
    expect(container.querySelector('.landing-my-planet-card')).toHaveAttribute('data-rarity', 'Common');
    expect(container.querySelectorAll('.landing-my-planet-card-media')).toHaveLength(3);
    expect(container.querySelectorAll('.landing-my-planet-card-minerals')).toHaveLength(3);
    expect(landing.getByText('Draheunia')).toBeInTheDocument();
    expect(landing.getByText('Ticket #5001')).toBeInTheDocument();
    expect(landing.getByText('25')).toBeInTheDocument();
    expect(landing.getByRole('region', { name: /How it works/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.landing-how-it-works details')).toHaveLength(8);
    expect(landing.queryByText('The core loop')).not.toBeInTheDocument();
    expect(landing.queryByText('Explore. Reveal. Compete.')).not.toBeInTheDocument();
    expect(landing.queryByText('No two discoveries')).not.toBeInTheDocument();
    expect(landing.queryByText('feel the same.')).not.toBeInTheDocument();
    expect(landing.queryByRole('region', { name: /Circular Planet gallery/ })).not.toBeInTheDocument();
    expect(container.querySelector('.landing-hero-lightfall')).toBeInTheDocument();
    expect(container.querySelector('.landing-live-jackpot')).toBeInTheDocument();
    expect(landing.getByText('LIVE JACKPOT')).toBeInTheDocument();
    expect(landing.getByText('DRAWING IN')).toBeInTheDocument();
    expect(container.querySelector('.landing-mystery-orbit')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.landing-mystery-orbit .orbit-item')).toHaveLength(0);
    expect(container.querySelectorAll('.landing-hero-title .split-parent')).toHaveLength(2);
    expect([...container.querySelectorAll('img')].filter((image) => image.getAttribute('src')?.includes('/artifacts/')).length).toBeGreaterThanOrEqual(3);
    expect([...container.querySelectorAll('img')].filter((image) => image.getAttribute('alt')?.startsWith('Unrevealed'))).toHaveLength(0);
  });

  it('uses SplitText across every landing copy block', () => {
    const { container } = render(<Landing />);

    const animatedCopySelectors = [
      '.landing-header .landing-wordmark .split-parent',
      '.landing-header .landing-button .split-parent',
      '.landing-hero-copy > .landing-kicker.split-parent',
      '.landing-hero-subtitle.split-parent',
      '.landing-hero-powered-by.split-parent',
      '.landing-hero-actions .landing-button .split-parent',
      '.landing-live-jackpot-header .landing-kicker.split-parent',
      '.landing-live-jackpot-status.split-parent',
      '.landing-live-jackpot-footer .landing-micro-label.split-parent',
      '.landing-live-jackpot-drawing.split-parent',
      '.landing-live-generator-button .split-parent',
      '.landing-mechanics-heading .landing-kicker.split-parent',
      '.landing-mechanics-heading h2 .split-parent',
      '.landing-mechanics-heading > .split-parent',
      '.landing-ticket-mechanic .landing-micro-label.split-parent',
      '.landing-ticket-mechanic h3 .split-parent',
      '.landing-ticket-mechanic > p.split-parent',
      '.landing-planet-mechanic .landing-micro-label.split-parent',
      '.landing-planet-mechanic h3 .split-parent',
      '.landing-planet-mechanic > p.split-parent',
      '.landing-mechanics-proof .landing-micro-label.split-parent',
      '.landing-mechanics-proof > .landing-proof-copy.split-parent',
      '.landing-mechanics-proof .landing-button .split-parent',
      '.landing-how-it-works .landing-kicker.split-parent',
      '.landing-how-it-works h2 .split-parent',
      '.landing-how-it-works .landing-how-it-works-intro.split-parent',
      '.landing-how-it-works .landing-faq-question.split-parent',
      '.landing-how-it-works .landing-faq-answer.split-parent',
      '.landing-footer .landing-wordmark .split-parent',
      '.landing-footer > .landing-footer-tagline.split-parent',
      '.landing-footer .landing-footer-meta.split-parent',
    ];

    for (const selector of animatedCopySelectors) {
      expect(container.querySelector(selector), selector).toBeInTheDocument();
    }
    expect(container.querySelectorAll('.landing .split-parent').length).toBeGreaterThanOrEqual(30);
  });
});
