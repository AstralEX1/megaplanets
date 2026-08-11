// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoordinatesPanel } from './CoordinatesDisclosure';

const baseProps = {
  bounds: { ballMax: 50, bonusballMax: 100 },
  manuallyEditedTickets: [],
  automaticQuickPick: true,
  onAutomaticQuickPickChange: vi.fn(),
  onTicketsChange: vi.fn(),
};

describe('CoordinatesPanel', () => {
  afterEach(cleanup);
  it('renders one animated quick-pick placeholder for each selected planet', () => {
    render(<CoordinatesPanel {...baseProps} quantity={3} />);

    expect(screen.getAllByTestId('quick-pick-ticket')).toHaveLength(3);
    expect(screen.getByText('Quick pick', { selector: '[data-ticket-index="1"] *' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit ticket/i })).not.toBeInTheDocument();
  });

  it('keeps known manual coordinates and fills only the remaining linked slots', () => {
    render(<CoordinatesPanel
      {...baseProps}
      quantity={3}
      manuallyEditedTickets={[{ normals: [1, 2, 3, 4, 5], bonusball: 6 }]}
    />);

    expect(screen.getByRole('button', { name: 'Edit ticket 1' })).toBeInTheDocument();
    expect(screen.getAllByTestId('quick-pick-ticket')).toHaveLength(2);
  });
});
