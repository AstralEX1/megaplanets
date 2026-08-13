// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanetMiningOverlay } from './PlanetMiningOverlay';

const mining = {
  tokenId: '7',
  baseMineralsPerDay: '24',
  effectiveMineralsPerDayMicros: '25200000',
  earnedMicros: '10100000',
  activeSince: '2026-08-10T00:00:00.000Z',
};

describe('PlanetMiningOverlay', () => {
  afterEach(cleanup);

  it('maps the backend mining snapshot into the intrinsic production metrics', () => {
    render(<PlanetMiningOverlay mining={mining} miningAsOf="2026-08-10T00:00:01.000Z" />);
    expect(screen.getByTestId('planet-mining-overlay')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Minerals' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mined' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Same type' })).not.toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('MINERALS / DAY')).toBeInTheDocument();
    expect(screen.getByText(/Mined 10\.1/)).toBeInTheDocument();
    expect(screen.queryByText(/same type/i)).not.toBeInTheDocument();
  });

  it('does not invent mining values when the backend snapshot is unavailable', () => {
    render(<PlanetMiningOverlay />);
    expect(screen.getByText('Mining unavailable')).toBeInTheDocument();
    expect(screen.queryByText('+0%')).not.toBeInTheDocument();
  });
});
