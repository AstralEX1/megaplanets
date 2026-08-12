export type TicketPurchasedFields = {
  ticketId?: bigint;
  drawingId?: bigint;
  normals?: readonly number[];
  bonusBall?: number;
  logIndex?: bigint | number | null;
};

export type ValidatedTicketPurchasedFields = {
  ticketId: bigint;
  drawingId: bigint;
  normals: readonly number[];
  bonusBall: number;
  logIndex: bigint;
};

const MAX_UINT8 = 255;

function normalizeLogIndex(value: TicketPurchasedFields['logIndex']): bigint {
  if (typeof value === 'bigint') {
    if (value >= 0n) return value;
  } else if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  throw new RangeError('TicketPurchased log index is missing or invalid.');
}

/** Strictly validates the fields emitted by the canonical TicketPurchased event. */
export function validateTicketPurchasedFields(
  fields: TicketPurchasedFields,
): ValidatedTicketPurchasedFields {
  if (fields.ticketId === undefined || fields.ticketId <= 0n) {
    throw new RangeError('TicketPurchased ticket ID is invalid.');
  }
  if (fields.drawingId === undefined || fields.drawingId <= 0n) {
    throw new RangeError('TicketPurchased drawing ID is invalid.');
  }
  if (!fields.normals || fields.normals.length !== 5) {
    throw new RangeError('TicketPurchased normal balls must contain exactly five values.');
  }
  const normals = [...fields.normals].map(Number).sort((left, right) => left - right);
  if (
    new Set(normals).size !== 5 ||
    normals.some((normal) => !Number.isInteger(normal) || normal < 1 || normal > MAX_UINT8)
  ) {
    throw new RangeError('TicketPurchased normal balls are invalid.');
  }
  if (
    fields.bonusBall === undefined ||
    !Number.isInteger(fields.bonusBall) ||
    fields.bonusBall < 1 ||
    fields.bonusBall > MAX_UINT8
  ) {
    throw new RangeError('TicketPurchased bonus ball is invalid.');
  }
  return {
    ticketId: fields.ticketId,
    drawingId: fields.drawingId,
    normals,
    bonusBall: fields.bonusBall,
    logIndex: normalizeLogIndex(fields.logIndex),
  };
}
