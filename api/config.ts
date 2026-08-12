import { isAddress, isHex } from 'viem';

export const BASE_SEPOLIA_CHAIN_ID = 84_532;
export const MEGAPLANETS_LAUNCH_BLOCK = 44_997_183n;
/** First canonical MegaPlanets_V1 ticket in the activation window before launch. */
export const MEGAPLANETS_TICKET_START_BLOCK = 44_996_796n;
export const MEGAPLANETS_SOURCE = 'MEGAPLANETS_V1';

export type Stage5Config = {
  rpcUrl: string;
  rpcFallbackUrls?: readonly string[];
  databaseUrl?: string;
  pinataJwt: string;
  signerPrivateKey: `0x${string}`;
  launchBlock: bigint;
  storePath?: string;
  planetContractAddress?: `0x${string}`;
  planetDeploymentBlock?: bigint;
};

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable ${name}.`);
  return value;
}

/** Reads server-only configuration and fails closed when a value is malformed. */
export function loadStage5Config(env: Record<string, string | undefined>): Stage5Config {
  const signerPrivateKey = required(env, 'MEGAPLANETS_METADATA_SIGNER_PRIVATE_KEY');
  if (!isHex(signerPrivateKey, { strict: true }) || signerPrivateKey.length !== 66) {
    throw new Error('MEGAPLANETS_METADATA_SIGNER_PRIVATE_KEY must be a 32-byte hex value.');
  }
  const configuredLaunchBlock = env.MEGAPLANETS_LAUNCH_BLOCK?.trim();
  const launchBlock = configuredLaunchBlock ? BigInt(configuredLaunchBlock) : MEGAPLANETS_LAUNCH_BLOCK;
  if (launchBlock !== MEGAPLANETS_LAUNCH_BLOCK) {
    throw new Error(`MEGAPLANETS_LAUNCH_BLOCK must remain ${MEGAPLANETS_LAUNCH_BLOCK}.`);
  }
  const configuredContract = env.MEGAPLANETS_CONTRACT_ADDRESS?.trim();
  if (configuredContract && !isAddress(configuredContract)) {
    throw new Error('MEGAPLANETS_CONTRACT_ADDRESS must be an EVM address.');
  }
  const configuredDeploymentBlock = env.MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK?.trim();
  const planetDeploymentBlock = configuredDeploymentBlock === undefined || configuredDeploymentBlock === '' ? undefined : BigInt(configuredDeploymentBlock);
  if (planetDeploymentBlock !== undefined && planetDeploymentBlock < 0n) throw new Error('MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK must be non-negative.');
  const rpcUrl = required(env, 'BASE_SEPOLIA_RPC_URL');
  const rpcFallbackUrls = (env.BASE_SEPOLIA_RPC_FALLBACK_URLS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => value !== rpcUrl && values.indexOf(value) === index);
  return {
    rpcUrl,
    rpcFallbackUrls,
    databaseUrl: env.DATABASE_URL?.trim() || undefined,
    pinataJwt: required(env, 'PINATA_JWT'),
    signerPrivateKey: signerPrivateKey as `0x${string}`,
    launchBlock,
    storePath: env.MEGAPLANETS_STORE_PATH?.trim(),
    planetContractAddress: configuredContract as `0x${string}` | undefined,
    planetDeploymentBlock,
  };
}
