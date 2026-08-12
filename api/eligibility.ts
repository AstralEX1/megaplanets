import { decodeEventLog, getAddress, stringToHex, type Address, type Hex, type Log } from 'viem';
import { MEGAPLANETS_SOURCE, MEGAPLANETS_TICKET_START_BLOCK } from './config';
import { validateTicketPurchasedFields } from '../shared/ticketValidation';

export const BASE_SEPOLIA_JACKPOT = getAddress('0x465dA3c859f193A3807386387bEE941B2A4c3279');
export const TICKET_PURCHASED_ABI = [{ type: 'event', name: 'TicketPurchased', inputs: [
  { indexed: true, name: 'recipient', type: 'address' }, { indexed: true, name: 'currentDrawingId', type: 'uint256' },
  { indexed: true, name: 'source', type: 'bytes32' }, { indexed: false, name: 'userTicketId', type: 'uint256' },
  { indexed: false, name: 'normals', type: 'uint8[]' }, { indexed: false, name: 'bonusball', type: 'uint8' },
  { indexed: false, name: 'referralScheme', type: 'bytes32' },
] }] as const;

export type EligibleTicket = { recipient: Address; ticketId: bigint; drawingId: bigint; normals: readonly number[]; bonusBall: number; originTxHash: Hex; blockNumber: bigint; logIndex: bigint; blockHash?: Hex; purchasedAt?: Date };

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
