// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompactPlanetDial } from './CompactPlanetDial';

describe('CompactPlanetDial', () => {
  afterEach(cleanup);

  it('limits the expedition slider to 1 through 50', () => {
    render(<CompactPlanetDial quantity={3} onChange={vi.fn()} />);

    const slider = screen.getByRole('slider', { name: 'Planets to explore' });

    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '50');
    expect(slider).toHaveValue('3');
  });

  it('emits the value while the slider is dragged', () => {
    const onChange = vi.fn();
    render(<CompactPlanetDial quantity={3} onChange={onChange} />);

    fireEvent.input(screen.getByRole('slider', { name: 'Planets to explore' }), { target: { value: '17' } });

    expect(onChange).toHaveBeenLastCalledWith(17);
  });
});
