import { describe, expect, it } from 'vitest';
import { navPath, parseAppRoute } from './appRoute';

describe('app routes', () => {
  it('uses /my-planets as the canonical collection route while accepting /planets', () => {
    expect(parseAppRoute('/my-planets')).toEqual({ active: 'planets' });
    expect(parseAppRoute('/planets')).toEqual({ active: 'planets' });
    expect(navPath('planets')).toBe('/my-planets');
  });

  it('parses a numeric Planet detail route', () => {
    expect(parseAppRoute('/planet/42')).toEqual({ active: 'planets', planetId: '42' });
    expect(parseAppRoute('/planet/not-a-token')).toEqual({ active: 'home' });
  });

  it('maps the visible primary navigation to stable paths', () => {
    expect(navPath('play')).toBe('/play');
    expect(navPath('history')).toBe('/leaderboard');
    expect(navPath('home')).toBe('/');
  });
});
