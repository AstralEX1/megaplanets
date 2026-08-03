import { decodeEventLog, encodeBytes32String, getAddress, type Address, type Hex, type Log } from 'viem';
import { MEGAPLANETS_LAUNCH_BLOCK } from './config';

export const BASE_SEPOLIA_JACKPOT = getAddress('0x465dA3c859f193A3807386387bEE941B2A4c3279');
export const TICKET_PURCHASED_ABI = [{ type: 'event', name: 'TicketPurchased', inputs: [
  { indexed: true, name: 'recipient', type: 'address' }, { indexed: true, name: 'currentDrawingId', type: 'uint256' },
  { indexed: true, name: 'source', type: 'bytes32' }, { indexed: false, name: 'userTicketId', type: 'uint256' },
  { indexed: false, name: 'normals', type: 'uint8[]' }, { indexed: false, name: 'bonusball', type: 'uint8' },
  { indexed: false, name: 'referralScheme', type: 'bytes32' },
] }] as const;

export type EligibleTicket = { recipient: Address; ticketId: bigint; drawingId: bigint; normals: readonly number[]; bonusBall: number; originTxHash: Hex };

/** Decodes only a canonical MegaPlanets purchase log; all other logs fail closed. */
export function decodeEligibleTicket(log: Log): EligibleTicket {
  if (getAddress(log.address) !== BASE_SEPOLIA_JACKPOT || !log.blockNumber || log.blockNumber < MEGAPLANETS_LAUNCH_BLOCK || !log.transactionHash) throw new Error('Ticket log is outside the eligible MegaPlanets range.');
  const event = decodeEventLog({ abi: TICKET_PURCHASED_ABI, data: log.data, topics: log.topics });
  if (event.eventName !== 'TicketPurchased' || event.args.source !== encodeBytes32String('MEGAPLANETS_V1')) throw new Error('Ticket was not purchased through MEGAPLANETS_V1.');
  const { recipient, currentDrawingId, userTicketId, normals, bonusball } = event.args;
  if (!recipient || !currentDrawingId || !userTicketId || !normals || bonusball === undefined || normals.length !== 5) throw new Error('Malformed TicketPurchased event.');
  return { recipient, ticketId: userTicketId, drawingId: currentDrawingId, normals: [...normals], bonusBall: bonusball, originTxHash: log.transactionHash };
}
