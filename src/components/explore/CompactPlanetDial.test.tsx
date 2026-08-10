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

    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '50');
    expect(slider).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByRole('button', { name: 'Selected planets thumb' })).toHaveStyle({ left: '4.081632653061225%' });
  });

  it('emits the value while the slider is dragged', () => {
    const onChange = vi.fn();
    render(<CompactPlanetDial quantity={3} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Planets to explore' }), { key: 'End' });

    expect(onChange).toHaveBeenLastCalledWith(50);
  });

  it('maps pointer position on the track to the selected quantity', () => {
    const onChange = vi.fn();
    render(<CompactPlanetDial quantity={3} onChange={onChange} />);

    const slider = screen.getByRole('slider', { name: 'Planets to explore' });
    Object.defineProperty(slider, 'getBoundingClientRect', { value: () => ({ left: 100, width: 490 }) });
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 340 });

    expect(onChange).toHaveBeenLastCalledWith(25);
  });
});
