// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExpeditionCompleteScreen, RevealCompleteScreen } from './ExpeditionSuccessScreens';

describe('Expedition success screens', () => {
  afterEach(cleanup);

  it('renders the confirmed ticket screen with the supplied reveal action', () => {
    render(
      <ExpeditionCompleteScreen
        count={3}
        revealAction={<button type="button">REVEAL (3)</button>}
      />,
    );

    expect(screen.getByText('EXPEDITION COMPLETE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'You found 3 planets!' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/unrevealed ticket/i)).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'REVEAL (3)' })).toBeInTheDocument();
    expect(screen.queryByText(/coordinates stay hidden/i)).not.toBeInTheDocument();
  });

  it('renders shared result cards without adding a mineral Claim action', () => {
    render(
      <RevealCompleteScreen
        cards={
          <div>
            <article>Planet card A</article>
            <article>Planet card B</article>
          </div>
        }
        drawingId={218n}
        onExploreAgain={vi.fn()}
        onViewPlanets={vi.fn()}
      />,
    );

    expect(screen.getByText('REVEAL COMPLETE')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Your new planets are ready.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Drawing #218 · Season 01')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Claim' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explore again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View in My Planets' })).toBeInTheDocument();
  });
});
