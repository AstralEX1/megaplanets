// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanetGeneratorHero } from './PlanetGeneratorHero';

vi.mock('@/components/planets/PlanetGif', () => ({
  PlanetGif: ({ preview }: { preview: { descriptor: { input: { ticketId: bigint } } } }) => (
    <span data-testid="planet-gif-preview">Generated ticket {preview.descriptor.input.ticketId.toString()}</span>
  ),
}));

describe('PlanetGeneratorHero', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates another Planet preview only on demand', () => {
    vi.useFakeTimers();
    const { container } = render(<PlanetGeneratorHero />);

    expect(screen.getByTestId('planet-gif-preview')).toHaveTextContent('Generated ticket 5001');
    expect(screen.getByRole('article', { name: 'Generated Planet preview' })).toBeInTheDocument();
    expect(container.querySelector('.landing-live-generator')).toBeInTheDocument();
    expect(container.querySelector('.landing-live-generator-topline')).not.toBeInTheDocument();
    expect(container.querySelector('.landing-live-generator-meta')).not.toBeInTheDocument();
    expect(container.querySelector('.landing-live-generator-art.landing-planet-card')).not.toBeInTheDocument();
    expect(screen.queryByText('PLANET = TICKET')).not.toBeInTheDocument();
    expect(screen.queryByText('MEGAPOT · IN DRAW')).not.toBeInTheDocument();

    const generatePlanetButton = screen.getByRole('button', { name: 'Generate planet' });
    expect(generatePlanetButton).not.toHaveTextContent('↗');
    expect(screen.queryByRole('button', { name: /Generate another/i })).not.toBeInTheDocument();

    fireEvent.click(generatePlanetButton);
    expect(screen.getByTestId('planet-gif-preview')).toHaveTextContent('Generated ticket 5002');

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByTestId('planet-gif-preview')).toHaveTextContent('Generated ticket 5002');
  });
});
