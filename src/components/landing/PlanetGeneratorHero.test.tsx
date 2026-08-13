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

  it('connects the generated Planet to a Megapot ticket and refreshes only on demand', () => {
    vi.useFakeTimers();
    const { container } = render(<PlanetGeneratorHero />);

    expect(screen.getByTestId('planet-gif-preview')).toHaveTextContent('Generated ticket 5001');
    expect(container.querySelector('.landing-live-generator')).toBeInTheDocument();
    expect(container.querySelector('.landing-live-generator-topline')).not.toBeInTheDocument();
    expect(container.querySelector('.landing-live-generator-meta')).not.toBeInTheDocument();
    expect(container.querySelector('.landing-live-generator-art.landing-planet-card')).not.toBeInTheDocument();
    expect(screen.queryByText('PLANET = TICKET')).not.toBeInTheDocument();
    expect(screen.queryByText('MEGAPOT · IN DRAW')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Generate another/i }));
    expect(screen.getByTestId('planet-gif-preview')).toHaveTextContent('Generated ticket 5002');

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByTestId('planet-gif-preview')).toHaveTextContent('Generated ticket 5002');
  });
});
