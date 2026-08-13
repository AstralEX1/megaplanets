// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingHowItWorks } from './LandingHowItWorks';

describe('LandingHowItWorks', () => {
  it('explains the ticket, Planet, and Megapot relationship through accessible FAQs', () => {
    const { container } = render(<LandingHowItWorks />);

    expect(screen.getByRole('region', { name: 'How it works' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument();
    expect(container.querySelectorAll('details')).toHaveLength(8);
    expect(screen.getByText('What is a Megapot Ticket?')).toBeInTheDocument();
    expect(screen.getByText('How does a ticket become a Planet?')).toBeInTheDocument();
    expect(screen.getByText('Is the Planet another ticket?')).toBeInTheDocument();
    expect(screen.getByText('Who powers the jackpot?')).toBeInTheDocument();
    expect(screen.getByText('How is the draw decided?')).toBeInTheDocument();
    expect(screen.getByText('What can a winning ticket receive?')).toBeInTheDocument();
    expect(screen.getByText('What happens after the draw?')).toBeInTheDocument();
    expect(screen.getByText('How does the Planet leaderboard fit in?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Is the Planet another ticket?'));
    fireEvent.click(screen.getByText('Who powers the jackpot?'));
    expect(screen.getByText(/A Megapot Ticket is a \$1 USDC entry for the daily draw/i)).toBeInTheDocument();
    expect(screen.getByText(/Megastera binds one generated Planet to that ticket/i)).toBeInTheDocument();
    expect(screen.getByText(/Pyth supplies verifiable randomness/i)).toBeInTheDocument();
    expect(screen.getByText(/70% of ticket value enters the jackpot pool/i)).toBeInTheDocument();
    expect(screen.getByText(/The Planet is not a second ticket/i)).toBeInTheDocument();
    expect(container.querySelectorAll('.landing-how-it-works .split-parent').length).toBeGreaterThanOrEqual(17);
  });
});
