export type OperationalRole = 'api' | 'indexer';

export type OperationalIndexerResult = {
  tickets?: { ticketsIndexed?: number; reorgDetected?: boolean };
  planets?: { eventsProcessed?: number; reorgDetected?: boolean };
  miningStatesInitialized?: number;
};

export type OperationalSnapshot = {
  role: OperationalRole;
  startedAt: string;
  requestsTotal: number;
  errorsTotal: number;
  indexerCyclesTotal: number;
  indexerFailuresTotal: number;
  lastIndexerCycleAt?: string;
  lastIndexerFailureAt?: string;
  lastIndexerDurationMs?: number;
  lastIndexerResult?: {
    ticketsIndexed: number;
    planetEventsProcessed: number;
    miningStatesInitialized: number;
    ticketReorgDetected: boolean;
    planetReorgDetected: boolean;
  };
};

export type OperationalState = {
  recordHttpRequest: (status: number) => void;
  recordIndexerCycle: (result: OperationalIndexerResult, durationMs: number) => void;
  recordIndexerFailure: (durationMs: number) => void;
  snapshot: () => OperationalSnapshot;
  reset: () => void;
};

export function createOperationalState(options: { role: OperationalRole; now?: () => number }): OperationalState {
  const now = options.now ?? Date.now;
  const startedAt = new Date(now()).toISOString();
  let requestsTotal = 0;
  let errorsTotal = 0;
  let indexerCyclesTotal = 0;
  let indexerFailuresTotal = 0;
  let lastIndexerCycleAt: string | undefined;
  let lastIndexerFailureAt: string | undefined;
  let lastIndexerDurationMs: number | undefined;
  let lastIndexerResult: OperationalSnapshot['lastIndexerResult'];

  return {
    recordHttpRequest(status) {
      requestsTotal += 1;
      if (status >= 500) errorsTotal += 1;
    },
    recordIndexerCycle(result, durationMs) {
      indexerCyclesTotal += 1;
      lastIndexerCycleAt = new Date(now()).toISOString();
      lastIndexerDurationMs = durationMs;
      lastIndexerResult = {
        ticketsIndexed: result.tickets?.ticketsIndexed ?? 0,
        planetEventsProcessed: result.planets?.eventsProcessed ?? 0,
        miningStatesInitialized: result.miningStatesInitialized ?? 0,
        ticketReorgDetected: result.tickets?.reorgDetected ?? false,
        planetReorgDetected: result.planets?.reorgDetected ?? false,
      };
    },
    recordIndexerFailure(durationMs) {
      indexerFailuresTotal += 1;
      lastIndexerFailureAt = new Date(now()).toISOString();
      lastIndexerDurationMs = durationMs;
    },
    snapshot() {
      return {
        role: options.role,
        startedAt,
        requestsTotal,
        errorsTotal,
        indexerCyclesTotal,
        indexerFailuresTotal,
        lastIndexerCycleAt,
        lastIndexerFailureAt,
        lastIndexerDurationMs,
        lastIndexerResult,
      };
    },
    reset() {
      requestsTotal = 0;
      errorsTotal = 0;
      indexerCyclesTotal = 0;
      indexerFailuresTotal = 0;
      lastIndexerCycleAt = undefined;
      lastIndexerFailureAt = undefined;
      lastIndexerDurationMs = undefined;
      lastIndexerResult = undefined;
    },
  };
}
