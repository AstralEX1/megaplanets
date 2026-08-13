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

    expect(slider).toHaveAttribute('type', 'range');
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '50');
    expect(slider).toHaveAttribute('aria-valuenow', '3');
    expect(slider).toHaveAttribute('aria-valuetext', '3 planets');
    expect(
      screen.queryByRole('button', { name: 'Selected planets thumb' }),
    ).not.toBeInTheDocument();
  });

  it('renders the slider markers as prominent quantity labels', () => {
    render(<CompactPlanetDial quantity={3} onChange={vi.fn()} />);

    for (const marker of [1, 5, 10, 25, 50]) {
      expect(screen.getByText(String(marker), { exact: true })).toBeVisible();
    }
  });

  it('emits the value while the slider is dragged', () => {
    const onChange = vi.fn();
    render(<CompactPlanetDial quantity={3} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Planets to explore' }), { key: 'End' });

    expect(onChange).toHaveBeenLastCalledWith(50);
  });

  it('forwards native range changes to the selected quantity', () => {
    const onChange = vi.fn();
    render(<CompactPlanetDial quantity={3} onChange={onChange} />);

    const slider = screen.getByRole('slider', { name: 'Planets to explore' });
    fireEvent.change(slider, { target: { value: '25' } });

    expect(onChange).toHaveBeenLastCalledWith(25);
  });

  it('submits a manually entered quantity on Enter', () => {
    const onChange = vi.fn();
    render(<CompactPlanetDial quantity={3} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom quantity' }));
    const input = screen.getByLabelText('Custom planet count');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith(42);
  });
});
