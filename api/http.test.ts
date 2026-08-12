import { describe, expect, it } from 'vitest';
import { readBoundedJson, withTimeout } from './http';

describe('bounded HTTP helpers', () => {
  it('rejects oversized request bodies before JSON parsing', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ value: '123456789' }) });
    await expect(readBoundedJson(request, 8)).rejects.toThrow(/too large/i);
  });

  it('fails a slow upstream operation at the configured deadline', async () => {
    await expect(withTimeout(new Promise((resolve) => setTimeout(resolve, 20)), 1, 'upstream')).rejects.toThrow('upstream timed out');
  });
});
