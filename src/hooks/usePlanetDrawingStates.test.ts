import { describe, expect, it } from 'vitest';
import { drawingStatusLabel } from './usePlanetDrawingStates';

describe('drawingStatusLabel', () => {
  it('maps historical API states without inventing intermediate protocol states', () => {
    expect(drawingStatusLabel('active')).toBe('DRAWING ACTIVE');
    expect(drawingStatusLabel('settled')).toBe('DRAWING SETTLED');
    expect(drawingStatusLabel(undefined)).toBe('DRAWING STATUS UNAVAILABLE');
  });
});
