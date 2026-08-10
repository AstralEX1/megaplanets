import { describe, expect, it } from 'vitest';
import { shouldRenderTargetCursor } from './TargetCursor';

describe('shouldRenderTargetCursor', () => {
  it('keeps the decorative cursor off touch and reduced-motion devices', () => {
    expect(shouldRenderTargetCursor({ pointerCoarse: false, prefersReducedMotion: false })).toBe(true);
    expect(shouldRenderTargetCursor({ pointerCoarse: true, prefersReducedMotion: false })).toBe(false);
    expect(shouldRenderTargetCursor({ pointerCoarse: false, prefersReducedMotion: true })).toBe(false);
  });
});
