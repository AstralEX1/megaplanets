// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DepthText } from './DepthText';

describe('DepthText', () => {
  it('keeps one accessible face while depth layers stay decorative', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container } = render(<DepthText text="Win up to $123.46" layers={6} />);

    expect(container.querySelector('.depth-text__face')).toHaveTextContent('Win up to $123.46');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(6);
  });

  it('starts the restored auto-orbit animation when reduced motion is disabled', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const requestAnimationFrame = vi.fn(() => 1);
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);

    const { unmount } = render(
      <DepthText text="Win up to $123.46" autoOrbit orbitSpeed={0.25} pointerTracking={false} />,
    );

    expect(requestAnimationFrame).toHaveBeenCalled();
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
