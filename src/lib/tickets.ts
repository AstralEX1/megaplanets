/**
 * ---
 * @skill      https://llms.megapot.io/tasks/buy-tickets
 * @customize  Pure functions: ticket randomization, route selection, cost calc.
 *             Edit MAX_CUSTOM_TICKETS and MAX_QTY_ONE_TIME
 *             to change UI caps. Routing thresholds match the protocol's
 *             `Jackpot.buyTickets` <=10 limit.
 * ---
 */
import { BONUSBALL_MIN } from '@/config/contracts';

/** UI cap on user-entered custom tickets, per the buy-bulk skill recommendation. */
export const MAX_CUSTOM_TICKETS = 10;
/** UI cap on a single one-time purchase. */
export const MAX_QTY_ONE_TIME = 50;
/** Threshold above which the bulk facilitator is required (per buy-bulk skill). */
export const BULK_THRESHOLD = 10;

/**
 * Hard cap on tickets per `Jackpot.claimWinnings` call. Above ~50, the
 * batched claim approaches block gas limit (per `claim-winnings` SKILL).
 * UI surfaces this cap when a round has more unclaimed wins than fit
 * in one tx; the user claims in chunks.
 */
export const MAX_CLAIM_BATCH = 50;

export type CustomTicket = { normals: number[]; bonusball: number };
export type TicketBounds = { ballMax: number; bonusballMax: number };
/** Returns the contract-ready static/dynamic split for an 11+ keeper bulk order. */
export function getBulkOrderShape(args: { count: number; staticTicketCount: number }) {
  if (!Number.isSafeInteger(args.count) || args.count <= BULK_THRESHOLD) {
    throw new RangeError(`Bulk orders require more than ${BULK_THRESHOLD} tickets.`);
  }
  if (
    !Number.isSafeInteger(args.staticTicketCount) ||
    args.staticTicketCount < 0 ||
    args.staticTicketCount > MAX_CUSTOM_TICKETS ||
    args.staticTicketCount > args.count
  ) {
    throw new RangeError(`Bulk orders support between 0 and ${MAX_CUSTOM_TICKETS} static tickets.`);
  }
  return {
    dynamicCount: args.count - args.staticTicketCount,
    staticTicketCount: args.staticTicketCount,
  };
}

/**
 * Total USDC cost for a purchase. Mirrors the protocol's cost formula:
 *   - one-time: ticketPriceUsdcRaw × count
 *
 * @returns bigint in raw 6-decimal USDC units (multiply by 10**-6 for display).
 */
export function totalCost(args: {
  ticketPriceUsdcRaw: bigint;
  count: number;
}): bigint {
  return args.ticketPriceUsdcRaw * BigInt(args.count);
}

/** Generate one random custom ticket — 5 unique normals + 1 bonusball. */
export function randomTicket(args: { ballMax: number; bonusballMax: number }): CustomTicket {
  if (!Number.isSafeInteger(args.ballMax) || args.ballMax < 5 || args.ballMax > 255) {
    throw new RangeError('ballMax must be a safe integer between 5 and 255.');
  }
  if (
    !Number.isSafeInteger(args.bonusballMax) ||
    args.bonusballMax < BONUSBALL_MIN ||
    args.bonusballMax > 255
  ) {
    throw new RangeError('bonusballMax must be a safe integer between the protocol minimum and 255.');
  }
  const normals = new Set<number>();
  while (normals.size < 5) {
    normals.add(1 + Math.floor(Math.random() * args.ballMax));
  }
  const bonusball =
    BONUSBALL_MIN + Math.floor(Math.random() * (args.bonusballMax - BONUSBALL_MIN + 1));
  return { normals: [...normals].sort((a, b) => a - b), bonusball };
}

/**
 * Produces the complete explicit ticket list required by `Jackpot.buyTickets`.
 * Users may configure up to `count` tickets; the remaining places are client-side
 * quick-picks, matching the MegaPlanets direct-purchase flow. Random picks are deliberately
 * made only at submission time, so preview rows never claim to be the final draw.
 */
export function buildDirectTickets(args: {
  customTickets: readonly CustomTicket[];
  count: number;
  bounds: TicketBounds;
  random?: (bounds: TicketBounds) => CustomTicket;
}): readonly CustomTicket[] {
  if (!Number.isSafeInteger(args.count) || args.count < 1 || args.count > BULK_THRESHOLD) {
    throw new RangeError(`Direct purchases require between 1 and ${BULK_THRESHOLD} tickets.`);
  }
  if (args.customTickets.length > args.count) {
    throw new RangeError('Custom ticket count cannot exceed the purchase quantity.');
  }
  if (!args.customTickets.every((ticket) => isValidTicket(ticket, args.bounds))) {
    throw new RangeError('Every custom ticket must use the current drawing bounds.');
  }

  const random = args.random ?? randomTicket;
  const tickets = [...args.customTickets];
  while (tickets.length < args.count) tickets.push(random(args.bounds));

  if (!tickets.every((ticket) => isValidTicket(ticket, args.bounds))) {
    throw new RangeError('A generated quick-pick does not satisfy the current drawing bounds.');
  }
  return tickets;
}

/** True iff the ticket has 5 unique normals in [1, ballMax] + a valid bonusball. */
export function isValidTicket(
  t: CustomTicket,
  bounds: { ballMax: number; bonusballMax: number },
): boolean {
  if (t.normals.length !== 5) return false;
  const unique = new Set(t.normals);
  if (unique.size !== 5) return false;
  for (const n of t.normals) {
    if (!Number.isInteger(n) || n < 1 || n > bounds.ballMax) return false;
  }
  if (
    !Number.isInteger(t.bonusball) ||
    t.bonusball < BONUSBALL_MIN ||
    t.bonusball > bounds.bonusballMax
  ) {
    return false;
  }
  return true;
}

/**
 * Count of normals the user matched against the winning numbers (for UI
 * highlighting). Tier ID is read from `Jackpot.getTicketTierIds` — do **not**
 * compute it here.
 */
export function matchOverlap(
  userNormals: readonly number[],
  winningNormals: readonly number[],
): number {
  const w = new Set(winningNormals);
  let matches = 0;
  for (const n of userNormals) if (w.has(n)) matches++;
  return matches;
}
