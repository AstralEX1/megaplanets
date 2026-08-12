import { isAddress } from 'viem';
import { z } from 'zod';
import { BASE_SEPOLIA_CHAIN_ID } from './config';

const environmentSchema = z.object({
  DATABASE_URL: z.string().trim().min(1),
  BASE_SEPOLIA_RPC_URL: z.string().url(),
  BASE_SEPOLIA_RPC_FALLBACK_URLS: z.string().optional(),
  MEGAPLANETS_APP_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  MEGAPLANETS_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(86_400),
  MEGAPLANETS_CONTRACT_ADDRESS: z.string().trim().optional(),
  MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK: z.string().regex(/^\d+$/).optional(),
});

export type Stage2Config = {
  databaseUrl: string;
  rpcUrl: string;
  rpcFallbackUrls?: readonly string[];
  appOrigin: string;
  sessionTtlSeconds: number;
  chainId: typeof BASE_SEPOLIA_CHAIN_ID;
  planetContractAddress?: `0x${string}`;
  planetDeploymentBlock?: bigint;
};

export function loadStage2Config(env: Record<string, string | undefined>): Stage2Config {
  const parsed = environmentSchema.parse(env);
  if (parsed.MEGAPLANETS_CONTRACT_ADDRESS && !isAddress(parsed.MEGAPLANETS_CONTRACT_ADDRESS)) {
    throw new Error('MEGAPLANETS_CONTRACT_ADDRESS must be an EVM address.');
  }
  return {
    databaseUrl: parsed.DATABASE_URL,
    rpcUrl: parsed.BASE_SEPOLIA_RPC_URL,
    rpcFallbackUrls: (parsed.BASE_SEPOLIA_RPC_FALLBACK_URLS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, values) => value !== parsed.BASE_SEPOLIA_RPC_URL && values.indexOf(value) === index),
    appOrigin: new URL(parsed.MEGAPLANETS_APP_ORIGIN).origin,
    sessionTtlSeconds: parsed.MEGAPLANETS_SESSION_TTL_SECONDS,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    planetContractAddress: parsed.MEGAPLANETS_CONTRACT_ADDRESS as `0x${string}` | undefined,
    planetDeploymentBlock: parsed.MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK
      ? BigInt(parsed.MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK)
      : undefined,
  };
}
