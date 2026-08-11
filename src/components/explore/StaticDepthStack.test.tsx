// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StaticDepthStack } from './StaticDepthStack';

describe('StaticDepthStack', () => {
  afterEach(cleanup);

  it('adds newly selected planets as animated visual slots', () => {
    const { rerender } = render(<StaticDepthStack quantity={1} />);

    expect(screen.getByRole('group', { name: 'Selected planets visualization' })).toHaveStyle({
      height: '350px',
    });
    const orbitItem = screen.getByTestId('planet-orbit').querySelector('.orbit-item');
    expect(orbitItem).toHaveStyle({
      width: '560px',
      height: '560px',
    });
    expect(orbitItem).toHaveStyle({ offsetPath: expect.stringContaining('A 42 24 0 1 0 742 700') });
    expect(screen.queryByTestId('orbit-planet-count')).not.toBeInTheDocument();

    rerender(<StaticDepthStack quantity={3} />);

    expect(screen.getAllByRole('img', { name: /selected planet/i })).toHaveLength(3);
    expect(screen.getByRole('group', { name: 'Selected planets visualization' })).toHaveStyle({
      height: '350px',
    });
    expect(screen.getByTestId('planet-orbit').querySelector('.orbit-item')).toHaveStyle({
      width: '510px',
      height: '510px',
    });
    expect(screen.queryByTestId('orbit-planet-count')).not.toBeInTheDocument();
  });

  it('keeps twenty planets on one orbit without an extra selected-count label', () => {
    render(<StaticDepthStack quantity={20} />);

    expect(screen.getAllByRole('img', { name: /selected planet/i })).toHaveLength(20);
    expect(screen.queryByText('20 planets selected')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Selected planets visualization' })).toHaveStyle({
      height: '350px',
    });
    expect(screen.queryByTestId('orbit-planet-count')).not.toBeInTheDocument();
  });

  it('keeps all visible planets on one orbit when the quantity exceeds twenty', () => {
    render(<StaticDepthStack quantity={50} />);

    expect(screen.getAllByRole('img', { name: /selected planet/i })).toHaveLength(50);
    expect(screen.getAllByTestId('planet-orbit')).toHaveLength(1);
    expect(screen.queryByTestId('orbit-planet-count')).not.toBeInTheDocument();
  });

  it('supports a future visual capacity without changing the orbit component', () => {
    render(<StaticDepthStack quantity={25} maxVisiblePlanets={25} />);

    expect(screen.getAllByRole('img', { name: /selected planet/i })).toHaveLength(25);
    expect(screen.getAllByTestId('planet-orbit')).toHaveLength(1);
  });
});
