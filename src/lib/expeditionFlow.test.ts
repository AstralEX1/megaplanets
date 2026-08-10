import { describe, expect, it } from 'vitest';
import { clampExpeditionQuantity } from './expeditionFlow';

describe('clampExpeditionQuantity', () => {
  it('keeps the Paper expedition range within 1 through 50', () => {
    expect(clampExpeditionQuantity(-2)).toBe(1);
    expect(clampExpeditionQuantity(3)).toBe(3);
    expect(clampExpeditionQuantity(99)).toBe(50);
  });
});
