import { describe, expect, it } from 'vitest';
import { backendApiUrl } from './backendApi';

describe('backendApiUrl', () => {
  it('keeps same-origin routes relative', () => {
    expect(backendApiUrl('/api/planets', '')).toBe('/api/planets');
  });

  it('resolves routes against a separate origin', () => {
    expect(backendApiUrl('/api/leaderboard/current', 'https://api.example.test/v2')).toBe(
      'https://api.example.test/api/leaderboard/current',
    );
  });
});
