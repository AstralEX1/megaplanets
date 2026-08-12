/**
 * ---
 * @skill      https://llms.megapot.io/contracts/reference
 * Set VITE_REFERRER_ADDRESS only for an explicitly approved deployment
 * configuration. The checked-in value is the approved MegaPlanets referrer;
 * never replace it with a dead address. Base Sepolia is the current target.
 * ---
 *
 * All Megapot contract addresses + chain-aware helpers. Single source of
 * truth — every hook reads from here so a chain switch is one env var.
 */

import { type Address, getAddress, isAddress, stringToHex } from 'viem';
import { base, baseSepolia } from 'viem/chains';

export type ChainName = 'mainnet' | 'testnet';

export function parseChainName(value: string | undefined): ChainName {
  if (value === undefined || value.trim() === '') return 'testnet';
  if (value === 'mainnet' || value === 'testnet') return value;
  throw new Error('VITE_CHAIN must be either "mainnet" or "testnet".');
}

export const CHAIN = parseChainName(import.meta.env.VITE_CHAIN);

export const VIEM_CHAIN = CHAIN === 'mainnet' ? base : baseSepolia;

/**
 * Block explorer for the active chain. Three prefixes are derived from a single
 * base map so address, tx, and NFT URLs stay in lockstep:
 *   `${EXPLORER_ADDRESS_URL}${addr}` → e.g. https://basescan.org/address/0x...
 *   `${EXPLORER_TX_URL}${hash}`      → e.g. https://basescan.org/tx/0x...
 *   `${EXPLORER_NFT_URL}${contract}/${tokenId}` → e.g. https://basescan.org/nft/0x.../1
 */
const EXPLORER_BASE: Record<ChainName, string> = {
  mainnet: 'https://basescan.org/',
  testnet: 'https://sepolia.basescan.org/',
};

/** Chain-resolved explorer URL prefix for addresses. Append the address. */
export const EXPLORER_ADDRESS_URL = `${EXPLORER_BASE[CHAIN]}address/`;

/** Chain-resolved explorer URL prefix for transactions. Append the tx hash. */
export const EXPLORER_TX_URL = `${EXPLORER_BASE[CHAIN]}tx/`;

/** Chain-resolved explorer URL prefix for individual ERC-721 tokens. Append contract/tokenId. */
export const EXPLORER_NFT_URL = `${EXPLORER_BASE[CHAIN]}nft/`;

/** USDC has 6 decimals on every chain Megapot deploys to. */
export const USDC_DECIMALS = 6;

/**
 * Per-drawing bonusball minimum. The protocol default is 1; per-drawing maxes
 * (`ballMax`, `bonusballMax`) come from `Jackpot.getDrawingState`. Override
 * here if a fork uses a different protocol configuration.
 */
export const BONUSBALL_MIN = 1;

/**
 * `bytes32` source identifier passed to ticket purchase calls (direct buys and
 * batch orders) for analytics attribution. It is part of the eligibility
 * invariant and must remain unchanged.
 *
 * Computed from a UTF-8 string padded to 32 bytes via `viem.stringToHex`.
 */
export const TICKET_SOURCE = stringToHex('MEGAPLANETS_V1', { size: 32 });

/** First Base Sepolia block whose MegaPlanets ticket events can mint Planets. */
export const MEGAPLANETS_LAUNCH_BLOCK = 44_997_183n;
/** First canonical MegaPlanets_V1 ticket in the pre-launch activation window. */
export const MEGAPLANETS_TICKET_START_BLOCK = 44_996_796n;

/**
 * Referral split weights — must sum to 1e18 (= 100%). Single referrer = `[1e18]`.
 * Up to 5 entries; align order with `_referrers`.
 */
export const REFERRAL_SPLIT_FULL: readonly bigint[] = [1_000_000_000_000_000_000n];

/**
 * Wallet that earns referral fees on every ticket purchased and every
 * winning claimed through this app. Read from `VITE_REFERRER_ADDRESS`
 * in your `.env`; falls back to the approved project referrer. Override it
 * only when the recipient has been explicitly approved for the environment.
 *
 * Per-ticket fee + win-share rates are protocol-level and readable at
 * runtime via `Jackpot.getDrawingState().referralFee` and
 * `.referralWinShare` (both 1e18-scaled).
 *
 * @see https://llms.megapot.io/tasks/claim-referral-fees
 */
export const DEFAULT_REFERRER_ADDRESS: Address = '0xCfc1044C749fD40E07FE33938414Fa573993F857';

const configuredReferrer = (import.meta.env.VITE_REFERRER_ADDRESS as string | undefined)?.trim();

/**
 * The project referrer is public configuration, never a signing credential.
 * An invalid local override falls back to the approved project address rather
 * than risking an unrecoverable referral assignment.
 */
export const REFERRER_ADDRESS: Address =
  configuredReferrer && isAddress(configuredReferrer)
    ? getAddress(configuredReferrer)
    : DEFAULT_REFERRER_ADDRESS;

const ADDRESSES = {
  USDC: {
    mainnet: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    testnet: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  Jackpot: {
    mainnet: '0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2',
    testnet: '0x465dA3c859f193A3807386387bEE941B2A4c3279',
  },
  JackpotTicketNFT: {
    mainnet: '0x48FfE35AbB9f4780a4f1775C2Ce1c46185b366e4',
    testnet: '0x45084829ac63f9dC6a3D4981A46FA896f9180ECd',
  },
  BatchPurchaseFacilitator: {
    mainnet: '0xBA343479D98a1Ed333899999D95a7343B808a76F',
    testnet: '0x62A5D60F486D01a28071652a7951Aff1EA4c5b7c',
  },
  GuaranteedMinimumPayoutCalculator: {
    mainnet: '0x97a22361b6208aC8cd9afaea09D20feC47046CBD',
    testnet: '0xE9542aC6FaDC47be2Bc42Fc075c1f481529D28cB',
  },
} as const satisfies Record<string, Record<ChainName, Address>>;

export const USDC_ADDRESS = ADDRESSES.USDC[CHAIN] as Address;
export const JACKPOT_ADDRESS = ADDRESSES.Jackpot[CHAIN] as Address;
export const JACKPOT_TICKET_NFT_ADDRESS = ADDRESSES.JackpotTicketNFT[CHAIN] as Address;
export function parseMegaPlanetsContractAddress(value: string | undefined): Address | undefined {
  const configured = value?.trim();
  if (!configured) return undefined;
  if (!isAddress(configured)) {
    throw new Error('VITE_MEGAPLANETS_CONTRACT_ADDRESS must be an EVM address.');
  }
  return getAddress(configured);
}

/** Active MegaPlanets ERC721A V2. Undefined until the V2 deployment gate is complete. */
export const MEGAPLANETS_CONTRACT_ADDRESS: Address | undefined =
  parseMegaPlanetsContractAddress(import.meta.env.VITE_MEGAPLANETS_CONTRACT_ADDRESS);
export const BATCH_PURCHASE_FACILITATOR_ADDRESS = ADDRESSES.BatchPurchaseFacilitator[
  CHAIN
] as Address;
export const PAYOUT_CALCULATOR_ADDRESS = ADDRESSES.GuaranteedMinimumPayoutCalculator[
  CHAIN
] as Address;
