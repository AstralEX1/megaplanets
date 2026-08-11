// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveMineralAmount } from './LiveMineralAmount';

describe('LiveMineralAmount', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('advances the displayed score without requesting a new canonical snapshot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'));
    render(<LiveMineralAmount snapshotMicros="5000000" effectiveMineralsPerDayMicros="86400000000" asOf="2026-08-10T00:00:00.000Z" />);
    expect(screen.getByText('5')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('6')).toBeInTheDocument();
  });
});
