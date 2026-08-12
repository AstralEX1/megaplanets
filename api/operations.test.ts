import { describe, expect, it } from 'vitest';
import { createOperationalState } from './operations';

describe('operational state', () => {
  it('starts with zero counters and no sensitive fields', () => {
    const state = createOperationalState({ role: 'api', now: () => 1_700_000_000_000 });

    expect(state.snapshot()).toEqual({
      role: 'api',
      startedAt: '2023-11-14T22:13:20.000Z',
      requestsTotal: 0,
      errorsTotal: 0,
      indexerCyclesTotal: 0,
      indexerFailuresTotal: 0,
      lastIndexerCycleAt: undefined,
      lastIndexerFailureAt: undefined,
      lastIndexerDurationMs: undefined,
      lastIndexerResult: undefined,
    });
  });

  it('records request and indexer cycle summaries without error text', () => {
    let now = 1_700_000_000_000;
    const state = createOperationalState({ role: 'indexer', now: () => now });

    state.recordHttpRequest(200);
    state.recordHttpRequest(503);
    now += 1_234;
    state.recordIndexerCycle(
      {
        tickets: { ticketsIndexed: 2, reorgDetected: false },
        planets: { eventsProcessed: 1, reorgDetected: true },
        miningStatesInitialized: 1,
      },
      987,
    );

    expect(state.snapshot()).toMatchObject({
      requestsTotal: 2,
      errorsTotal: 1,
      indexerCyclesTotal: 1,
      indexerFailuresTotal: 0,
      lastIndexerDurationMs: 987,
      lastIndexerResult: {
        ticketsIndexed: 2,
        planetEventsProcessed: 1,
        miningStatesInitialized: 1,
        ticketReorgDetected: false,
        planetReorgDetected: true,
      },
    });
    expect(JSON.stringify(state.snapshot())).not.toContain('secret');
  });

  it('records failures as counters without persisting exception messages', () => {
    const state = createOperationalState({ role: 'indexer', now: () => 1_700_000_000_000 });

    state.recordIndexerFailure(321);

    expect(state.snapshot()).toMatchObject({
      indexerCyclesTotal: 0,
      indexerFailuresTotal: 1,
      lastIndexerDurationMs: 321,
      lastIndexerFailureAt: '2023-11-14T22:13:20.000Z',
    });
    expect(state.snapshot()).not.toHaveProperty('lastIndexerError');
  });
});
