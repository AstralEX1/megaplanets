// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UnrevealedPlanetVisual } from './UnrevealedPlanetVisual';

describe('UnrevealedPlanetVisual', () => {
  it('renders the shared unrevealed planet artwork without exposing traits', () => {
    render(<UnrevealedPlanetVisual label="Unrevealed planet" />);

    expect(screen.getByRole('img', { name: 'Unrevealed planet' })).toHaveAttribute(
      'src',
      expect.stringContaining('unrevealed-planet'),
    );
    expect(screen.queryByText(/Kepler|minerals|Gaia/i)).not.toBeInTheDocument();
  });
});
