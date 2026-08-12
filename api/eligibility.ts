import { decodeEventLog, getAddress, isHash, stringToHex, type Address, type Hex, type Log, type TransactionReceipt } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, MEGAPLANETS_SOURCE, MEGAPLANETS_TICKET_START_BLOCK } from './config';
import { validateTicketPurchasedFields } from '../shared/ticketValidation';

export const BASE_SEPOLIA_JACKPOT = getAddress('0x465dA3c859f193A3807386387bEE941B2A4c3279');
export const TICKET_PURCHASED_ABI = [{ type: 'event', name: 'TicketPurchased', inputs: [
  { indexed: true, name: 'recipient', type: 'address' }, { indexed: true, name: 'currentDrawingId', type: 'uint256' },
  { indexed: true, name: 'source', type: 'bytes32' }, { indexed: false, name: 'userTicketId', type: 'uint256' },
  { indexed: false, name: 'normals', type: 'uint8[]' }, { indexed: false, name: 'bonusball', type: 'uint8' },
  { indexed: false, name: 'referralScheme', type: 'bytes32' },
] }] as const;

export type EligibleTicket = { recipient: Address; ticketId: bigint; drawingId: bigint; normals: readonly number[]; bonusBall: number; originTxHash: Hex; blockNumber: bigint; logIndex: bigint; blockHash?: Hex; purchasedAt?: Date };

/**
 * A server-side proof that a canonical Megapot receipt produced one eligible
 * MegaPlanets ticket. The optional deployment fields keep compatibility with
 * pre-proof callers while every proof produced by MegasteraVerifier includes
 * them.
 */
export type MegasteraProof = EligibleTicket & {
  chainId?: number;
  jackpotAddress?: Address;
  source?: Hex;
};

export type MegasteraProofReference = {
  transactionHash?: Hex;
  originTxHash?: Hex;
  logIndex: bigint | number;
};

const CANONICAL_SOURCE = stringToHex(MEGAPLANETS_SOURCE, { size: 32 });

function asBigInt(value: unknown, label: string): bigint {
  try {
    const result = typeof value === 'bigint' ? value : BigInt(String(value));
    if (result < 0n) throw new Error();
    return result;
  } catch {
    throw new Error(`Megastera proof ${label} is invalid.`);
  }
}

/** Normalizes persisted proof data and fails closed on any non-canonical field. */
export function normalizeMegasteraProof(value: MegasteraProof | Record<string, unknown>): MegasteraProof {
  if (!value || typeof value !== 'object') throw new Error('Megastera proof is malformed.');
  const candidate = value as Partial<MegasteraProof> & Record<string, unknown>;
  const originTxHash = candidate.originTxHash;
  if (typeof originTxHash !== 'string' || !isHash(originTxHash)) throw new Error('Megastera proof transaction hash is invalid.');
  const blockHash = candidate.blockHash;
  if (blockHash !== undefined && (typeof blockHash !== 'string' || !isHash(blockHash))) throw new Error('Megastera proof block hash is invalid.');
  const chainId = candidate.chainId ?? BASE_SEPOLIA_CHAIN_ID;
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) throw new Error('Megastera proof chain is not Base Sepolia.');
  const jackpotAddress = candidate.jackpotAddress === undefined ? BASE_SEPOLIA_JACKPOT : getAddress(candidate.jackpotAddress);
  if (jackpotAddress !== BASE_SEPOLIA_JACKPOT) throw new Error('Megastera proof jackpot is not canonical.');
  const source = candidate.source ?? CANONICAL_SOURCE;
  if (typeof source !== 'string' || source.toLowerCase() !== CANONICAL_SOURCE.toLowerCase()) throw new Error('Ticket was not purchased through MEGAPLANETS_V1.');
  const validated = validateTicketPurchasedFields({
    ticketId: asBigInt(candidate.ticketId, 'ticket ID'),
    drawingId: asBigInt(candidate.drawingId, 'drawing ID'),
    normals: candidate.normals,
    bonusBall: candidate.bonusBall,
    logIndex: asBigInt(candidate.logIndex, 'log index'),
  });
  const blockNumber = asBigInt(candidate.blockNumber, 'block number');
  if (blockNumber < MEGAPLANETS_TICKET_START_BLOCK) throw new Error('Megastera proof block is outside the eligible range.');
  return {
    ...candidate,
    recipient: getAddress(candidate.recipient as Address),
    originTxHash: originTxHash.toLowerCase() as Hex,
    blockHash: blockHash?.toLowerCase() as Hex | undefined,
    chainId,
    jackpotAddress,
    source: CANONICAL_SOURCE,
    ...validated,
    blockNumber,
  };
}

/** Decodes only a canonical MegaPlanets purchase log; all other logs fail closed. */
export function decodeEligibleTicket(log: Log): EligibleTicket {
  if (getAddress(log.address) !== BASE_SEPOLIA_JACKPOT || !log.blockNumber || log.blockNumber < MEGAPLANETS_TICKET_START_BLOCK || !log.transactionHash) throw new Error('Ticket log is outside the eligible MegaPlanets range.');
  const event = decodeEventLog({ abi: TICKET_PURCHASED_ABI, data: log.data, topics: log.topics });
  if (event.eventName !== 'TicketPurchased' || event.args.source !== stringToHex(MEGAPLANETS_SOURCE, { size: 32 })) throw new Error('Ticket was not purchased through MEGAPLANETS_V1.');
  const { recipient } = event.args;
  if (!recipient) throw new Error('Malformed TicketPurchased event.');
  const validated = validateTicketPurchasedFields({
    ticketId: event.args.userTicketId,
    drawingId: event.args.currentDrawingId,
    normals: event.args.normals,
    bonusBall: event.args.bonusball,
    logIndex: log.logIndex,
  });
  return { recipient, ...validated, originTxHash: log.transactionHash, blockNumber: log.blockNumber };
}

/** Locates one log in a confirmed receipt before applying the fail-closed eligibility decoder. */
export function findEligibleTicket(logs: readonly Log[], logIndex: number): EligibleTicket {
  const log = logs.find((candidate) => candidate.logIndex === logIndex);
  if (!log) throw new Error(`TicketPurchased log ${logIndex} was not found in the receipt.`);
  return decodeEligibleTicket(log);
}

export type MegasteraVerifierOptions = {
  chainId?: number;
  jackpotAddress?: Address;
  minimumBlock?: bigint;
};

/** Verifies receipt finality and event provenance before producing a MegasteraProof. */
export class MegasteraVerifier {
  private readonly chainId: number;
  private readonly jackpotAddress: Address;
  private readonly minimumBlock: bigint;

  public constructor(options: MegasteraVerifierOptions = {}) {
    this.chainId = options.chainId ?? BASE_SEPOLIA_CHAIN_ID;
    this.jackpotAddress = options.jackpotAddress ? getAddress(options.jackpotAddress) : BASE_SEPOLIA_JACKPOT;
    this.minimumBlock = options.minimumBlock ?? MEGAPLANETS_TICKET_START_BLOCK;
    if (this.chainId !== BASE_SEPOLIA_CHAIN_ID || this.jackpotAddress !== BASE_SEPOLIA_JACKPOT) {
      throw new Error('Megastera verifier is configured for Base Sepolia MegaPlanets only.');
    }
  }

  public verifyReceipt(
    receipt: TransactionReceipt,
    reference: { logIndex: bigint | number; transactionHash?: Hex; originTxHash?: Hex; recipient?: Address },
  ): MegasteraProof {
    if (receipt.status !== 'success') throw new Error('Transaction receipt did not succeed.');
    if (!receipt.transactionHash || !isHash(receipt.transactionHash) || !receipt.blockHash || !receipt.blockNumber) {
      throw new Error('Transaction receipt has no finalized block provenance.');
    }
    const logIndex = typeof reference.logIndex === 'bigint' ? Number(reference.logIndex) : reference.logIndex;
    if (!Number.isSafeInteger(logIndex) || logIndex < 0) throw new Error('Megastera proof log index is invalid.');
    const receiptLog = receipt.logs.find((candidate) => candidate.logIndex === logIndex);
    if (!receiptLog) throw new Error(`TicketPurchased log ${logIndex} was not found in the receipt.`);
    const log = {
      ...receiptLog,
      address: receiptLog.address,
      transactionHash: receiptLog.transactionHash ?? receipt.transactionHash,
      blockHash: receiptLog.blockHash ?? receipt.blockHash,
      blockNumber: receiptLog.blockNumber ?? receipt.blockNumber,
      logIndex: receiptLog.logIndex ?? logIndex,
    } as Log;
    const logTransactionHash = log.transactionHash as Hex;
    if (logTransactionHash.toLowerCase() !== receipt.transactionHash.toLowerCase()) throw new Error('Receipt log transaction hash is not canonical.');
    const expectedTransactionHash = reference.transactionHash ?? reference.originTxHash;
    if (expectedTransactionHash && expectedTransactionHash.toLowerCase() !== receipt.transactionHash.toLowerCase()) throw new Error('Receipt transaction hash does not match the requested proof.');
    if (log.blockHash?.toLowerCase() !== receipt.blockHash.toLowerCase() || log.blockNumber !== receipt.blockNumber) {
      throw new Error('Receipt log does not belong to the finalized receipt block.');
    }
    if (reference.recipient && getAddress(reference.recipient) !== getAddress(decodeEligibleTicket(log).recipient)) {
      throw new Error('TicketPurchased recipient does not match the requested wallet.');
    }
    const ticket = decodeEligibleTicket({ ...log, blockNumber: receipt.blockNumber });
    if (ticket.blockNumber < this.minimumBlock) throw new Error('Megastera proof block is outside the eligible range.');
    return normalizeMegasteraProof({
      ...ticket,
      chainId: this.chainId,
      jackpotAddress: this.jackpotAddress,
      source: CANONICAL_SOURCE,
      blockHash: receipt.blockHash,
    });
  }

  /** Short alias for callers that already use verifier terminology. */
  public verify(receipt: TransactionReceipt, reference: { logIndex: bigint | number; transactionHash?: Hex; originTxHash?: Hex; recipient?: Address }): MegasteraProof {
    return this.verifyReceipt(receipt, reference);
  }
}
