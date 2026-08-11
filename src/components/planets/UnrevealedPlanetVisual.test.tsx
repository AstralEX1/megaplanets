// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnrevealedPlanetVisual } from './UnrevealedPlanetVisual';

describe('UnrevealedPlanetVisual', () => {
  afterEach(() => vi.restoreAllMocks());

  it('selects a random mystery color once for each mount without exposing traits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    render(<UnrevealedPlanetVisual label="Unrevealed planet" />);

    expect(screen.getByRole('img', { name: 'Unrevealed planet' })).toHaveAttribute(
      'src',
      expect.stringContaining('violet'),
    );
    expect(Math.random).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Kepler|minerals|Gaia/i)).not.toBeInTheDocument();
  });
});
