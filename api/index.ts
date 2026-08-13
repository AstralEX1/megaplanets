import { Hono } from 'hono';
import {
  type Address,
  createPublicClient,
  getAddress,
  type Hex,
  http,
  isAddress,
  isHash,
  type TransactionReceipt,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_RECEIPT_CONFIRMATIONS,
  loadStage5Config,
  type Stage5Config,
} from './config';
import { createCorsMiddleware } from './cors';
import { getPrismaClient } from './database';
import { type MegasteraProof, MegasteraVerifier, normalizeMegasteraProof } from './eligibility';
import { readBoundedJson, withTimeout } from './http';
import { createLeaderboardRoutes } from './leaderboardRoutes';
import { ensureOverdueLeaderboardPeriodsFinalized } from './leaderboardStore';
import { createOperationalState, type OperationalState } from './operations';
import { PrismaEligibilityStore } from './prismaEligibilityStore';
import { assertMetadataSignerMatch, assertProductionDatabase } from './readiness';
import { readWithRpcFallback } from './rpc';
import { prepareVoucher } from './service';
import { createStage2Routes, type Stage2Dependencies } from './stage2';
import { type EligibilityStore, FileEligibilityStore, type PreparedVoucher } from './store';
import { VoucherServiceError, voucherErrorResponse } from './voucherErrors';

type VoucherRequest = { transactionHash: Hex; logIndex: number; recipient?: Address };

const BASE_SEPOLIA_TICKET_NFT = getAddress('0x45084829ac63f9dC6a3D4981A46FA896f9180ECd');
const MAX_RPC_ENDPOINTS = 3;
const ticketOwnerAbi = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;
const planetMintedAbi = [
  {
    type: 'function',
    name: 'planetMinted',
    stateMutability: 'view',
    inputs: [{ name: 'ticketId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

type VoucherRpcClient = {
  getChainId(): Promise<number>;
  getTransactionReceipt(args: { hash: Hex }): Promise<TransactionReceipt>;
  getBlockNumber(): Promise<bigint>;
  getBlock(args: { blockNumber: bigint } | { blockHash: Hex }): Promise<{
    hash: Hex | null;
    timestamp: bigint;
  }>;
  readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args: readonly [bigint];
  }): Promise<unknown>;
};

type RpcClientFactory = (rpcUrl: string) => VoucherRpcClient;

function rpcEndpoints(config: Stage5Config): readonly string[] {
  return [...new Set([config.rpcUrl, ...(config.rpcFallbackUrls ?? [])])].slice(
    0,
    MAX_RPC_ENDPOINTS,
  );
}

const metadataSignerAbi = [
  {
    type: 'function',
    name: 'metadataSigner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export type ReceiptFinalityInput = {
  blockNumber: bigint;
  blockHash: string;
};

export type ReceiptFinalityState = {
  latestBlock: bigint;
  canonicalBlockHash: string;
  confirmations?: bigint;
};

/** Fails closed when a receipt is not deep enough or its block was reorged. */
export function assertReceiptFinality(
  receipt: ReceiptFinalityInput,
  state: ReceiptFinalityState,
): void {
  const confirmations = state.confirmations ?? DEFAULT_RECEIPT_CONFIRMATIONS;
  if (confirmations < 0n) throw new Error('Receipt confirmation depth must be non-negative.');
  if (state.latestBlock < receipt.blockNumber + confirmations) {
    throw new Error(`Receipt requires ${confirmations.toString()} confirmations.`);
  }
  if (state.canonicalBlockHash.toLowerCase() !== receipt.blockHash.toLowerCase()) {
    throw new Error('Receipt block hash is no longer canonical.');
  }
}

type Stage5Dependencies = {
  loadConfig: () => Stage5Config;
  findTicket: (config: Stage5Config, request: VoucherRequest) => Promise<MegasteraProof>;
  validateAuthority: (config: Stage5Config, proof: MegasteraProof) => Promise<void>;
  prepare: (
    config: Stage5Config,
    ticket: MegasteraProof,
    artifact?: import('./store').PlanetArtifact,
  ) => Promise<PreparedVoucher>;
  getStore: (config: Stage5Config) => EligibilityStore;
  rateLimiter: VoucherRateLimiter;
  workLimiter: VoucherWorkLimiter;
  readiness: (config: Stage5Config) => Promise<boolean>;
  operations: OperationalState;
};

export type VoucherRateLimiter = { allows: (key: string) => boolean };
export type VoucherWorkLimiter = { run<T>(operation: () => Promise<T>): Promise<T> };

/** Small process-local guard for expensive voucher preparation. A deployed service still needs durable edge rate limiting. */
// One wallet can legitimately reveal two full 50-ticket batches and then retry a single ticket
// inside the same minute. Keep the local guard above that supported UI workload.
export function createVoucherRateLimiter(
  limit = 120,
  windowMs = 60_000,
  now = () => Date.now(),
): VoucherRateLimiter {
  const requests = new Map<string, { count: number; resetsAt: number }>();
  return {
    allows(key) {
      const timestamp = now();
      const current = requests.get(key);
      if (!current || current.resetsAt <= timestamp) {
        requests.set(key, { count: 1, resetsAt: timestamp + windowMs });
        return true;
      }
      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    },
  };
}

export function createVoucherWorkLimiter(limit = 2): VoucherWorkLimiter {
  let active = 0;
  const queue: Array<() => void> = [];
  const drain = () => {
    while (active < limit && queue.length) {
      active += 1;
      queue.shift()?.();
    }
  };
  return {
    run<T>(operation: () => Promise<T>) {
      return new Promise<T>((resolve, reject) => {
        queue.push(() => {
          operation()
            .then(resolve, reject)
            .finally(() => {
              active -= 1;
              drain();
            });
        });
        drain();
      });
    },
  };
}

type ReadinessChain = { chainId: number; code: Hex; metadataSigner: Address };
type ReadinessProbeOverrides = {
  databaseProbe?: (databaseUrl: string) => Promise<unknown>;
  readChain?: (config: Stage5Config) => Promise<ReadinessChain>;
};

/** Reads the contract's configured signer and validates the ABI result. */
export async function readMetadataSigner(read: () => Promise<unknown>): Promise<Address> {
  const value = await read();
  if (typeof value !== 'string' || !isAddress(value))
    throw new Error('V2 metadata signer lookup returned an invalid address.');
  return value as Address;
}

async function readReadinessChain(config: Stage5Config): Promise<ReadinessChain> {
  const rpcUrls = [config.rpcUrl, ...(config.rpcFallbackUrls ?? [])];
  return readWithRpcFallback(rpcUrls, async (rpcUrl) => {
    const client = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
    const [chainId, code] = await Promise.all([
      client.getChainId(),
      client.getCode({ address: config.planetContractAddress as `0x${string}` }),
    ]);
    if (chainId !== BASE_SEPOLIA_CHAIN_ID || !code || code === '0x')
      throw new Error('Base Sepolia V2 contract probe failed.');
    const metadataSigner = await readMetadataSigner(() =>
      client.readContract({
        address: config.planetContractAddress as `0x${string}`,
        abi: metadataSignerAbi,
        functionName: 'metadataSigner',
      }),
    );
    return { chainId, code, metadataSigner };
  });
}

export async function probeStage5Readiness(
  config: Stage5Config,
  overrides: ReadinessProbeOverrides = {},
): Promise<boolean> {
  if (
    !config.databaseUrl ||
    !config.planetContractAddress ||
    config.planetDeploymentBlock === undefined
  )
    return false;
  // Unit and local route tests intentionally use placeholder endpoints.
  if (!overrides.readChain && config.rpcUrl.includes('.example.')) return true;
  try {
    const databaseProbe =
      overrides.databaseProbe ??
      (async (databaseUrl: string) => {
        const database = getPrismaClient(databaseUrl);
        await withTimeout(database.$queryRaw`SELECT 1`, 5_000, 'Database readiness lookup');
      });
    const readChain = overrides.readChain ?? readReadinessChain;
    const configuredSigner = privateKeyToAccount(config.signerPrivateKey);
    const [_databaseProbe, chain] = await Promise.all([
      withTimeout(databaseProbe(config.databaseUrl), 5_000, 'Database readiness lookup'),
      withTimeout(readChain(config), 5_000, 'RPC chain and contract lookup'),
    ]);
    if (chain.chainId !== BASE_SEPOLIA_CHAIN_ID || !chain.code || chain.code === '0x') return false;
    assertMetadataSignerMatch(configuredSigner.address, chain.metadataSigner);
    return config.pinataJwt.length > 0;
  } catch {
    return false;
  }
}

function parseVoucherRequest(value: unknown): VoucherRequest | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { transactionHash, logIndex, recipient } = value as Record<string, unknown>;
  if (
    typeof transactionHash !== 'string' ||
    !isHash(transactionHash) ||
    typeof logIndex !== 'number' ||
    !Number.isSafeInteger(logIndex) ||
    logIndex < 0
  )
    return undefined;
  if (recipient !== undefined && (typeof recipient !== 'string' || !isAddress(recipient)))
    return undefined;
  return {
    transactionHash,
    logIndex,
    recipient: recipient === undefined ? undefined : getAddress(recipient),
  };
}

type ProofPagination = { offset: number; limit: number };

function parseProofPagination(c: {
  req: { query: (name: string) => string | undefined };
}): ProofPagination | undefined {
  const offsetValue = c.req.query('offset') ?? '0';
  const limitValue = c.req.query('limit') ?? '50';
  const offset = Number(offsetValue);
  const limit = Number(limitValue);
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return undefined;
  }
  return { offset, limit };
}

function serializeMegasteraProof(proof: MegasteraProof) {
  return {
    recipient: getAddress(proof.recipient),
    ticketId: proof.ticketId.toString(),
    drawingId: proof.drawingId.toString(),
    normals: [...proof.normals],
    bonusBall: proof.bonusBall,
    originTxHash: proof.originTxHash,
    blockNumber: proof.blockNumber.toString(),
    blockHash: proof.blockHash,
    logIndex: proof.logIndex.toString(),
    purchasedAt: proof.purchasedAt?.toISOString(),
    chainId: proof.chainId,
    jackpotAddress: proof.jackpotAddress,
    source: proof.source,
  };
}

/** JSON cannot represent bigint values, so API responses use decimal strings for contract integers. */
function serializePreparedVoucher(prepared: PreparedVoucher) {
  const { voucher } = prepared;
  return {
    ...prepared,
    voucher: {
      ...voucher,
      ticketId: voucher.ticketId.toString(),
      drawingId: voucher.drawingId.toString(),
      expiresAt: voucher.expiresAt.toString(),
    },
  };
}

let requestSequence = 0;

function requestId(c: { req: { header: (name: string) => string | undefined } }): string {
  const supplied = c.req.header('x-request-id')?.trim();
  if (supplied && supplied.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(supplied)) return supplied;
  requestSequence = (requestSequence + 1) % 1_000_000;
  return `voucher-${Date.now().toString(36)}-${requestSequence.toString(36)}`;
}

function voucherFailure(
  c: { json: (body: unknown, status?: number) => Response },
  error: VoucherServiceError,
  id: string,
) {
  return c.json(voucherErrorResponse(error, id), error.status);
}

export async function findTicketFromReceipt(
  config: Stage5Config,
  request: VoucherRequest,
  makeClient: RpcClientFactory = (rpcUrl) =>
    createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    }) as unknown as VoucherRpcClient,
): Promise<MegasteraProof> {
  // Every endpoint performs the complete verification sequence. A stale primary
  // must not return a receipt that is only disproven after fallback selection.
  return readWithRpcFallback(rpcEndpoints(config), async (rpcUrl) => {
    const client = makeClient(rpcUrl);
    const chainId = await client.getChainId();
    if (chainId !== BASE_SEPOLIA_CHAIN_ID) throw new Error('Receipt RPC is not Base Sepolia.');
    const receipt = await client.getTransactionReceipt({ hash: request.transactionHash });
    if (!receipt) throw new Error(`Receipt ${request.transactionHash} was not found on ${rpcUrl}.`);
    const ticket = new MegasteraVerifier({ chainId }).verifyReceipt(receipt, {
      transactionHash: request.transactionHash,
      logIndex: request.logIndex,
      recipient: request.recipient,
    });
    const [latestBlock, canonicalBlock, receiptBlock] = await Promise.all([
      client.getBlockNumber(),
      client.getBlock({ blockNumber: receipt.blockNumber }),
      client.getBlock({ blockHash: receipt.blockHash }),
    ]);
    if (!canonicalBlock.hash || !receiptBlock.hash)
      throw new Error('Receipt block hash lookup is incomplete.');
    assertReceiptFinality(
      { blockNumber: receipt.blockNumber, blockHash: receipt.blockHash },
      {
        latestBlock,
        canonicalBlockHash: canonicalBlock.hash,
        confirmations: config.confirmations,
      },
    );
    if (receiptBlock.hash.toLowerCase() !== receipt.blockHash.toLowerCase()) {
      throw new Error('Receipt block hash lookup does not match the receipt.');
    }
    const timestamp = Number(receiptBlock.timestamp);
    if (!Number.isSafeInteger(timestamp) || timestamp < 0)
      throw new Error('Receipt block timestamp is invalid.');
    return {
      ...ticket,
      blockHash: receipt.blockHash,
      purchasedAt: new Date(timestamp * 1_000),
    };
  });
}

/**
 * Checks the two on-chain authorities immediately before media preparation.
 * The check is deliberately endpoint-scoped so a stale or wrong-chain primary
 * cannot turn into a false eligibility result.
 */
export async function validateTicketAuthority(
  config: Stage5Config,
  proof: MegasteraProof,
  makeClient: RpcClientFactory = (rpcUrl) =>
    createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    }) as unknown as VoucherRpcClient,
): Promise<void> {
  if (!config.planetContractAddress)
    throw new Error('MEGAPLANETS_CONTRACT_ADDRESS is required for authority validation.');
  const planetContract = getAddress(config.planetContractAddress);
  await readWithRpcFallback(rpcEndpoints(config), async (rpcUrl) => {
    const client = makeClient(rpcUrl);
    const chainId = await client.getChainId();
    if (chainId !== BASE_SEPOLIA_CHAIN_ID) throw new Error('Authority RPC is not Base Sepolia.');
    const [owner, minted] = await Promise.all([
      client.readContract({
        address: BASE_SEPOLIA_TICKET_NFT,
        abi: ticketOwnerAbi,
        functionName: 'ownerOf',
        args: [proof.ticketId],
      }),
      client.readContract({
        address: planetContract,
        abi: planetMintedAbi,
        functionName: 'planetMinted',
        args: [proof.ticketId],
      }),
    ]);
    if (getAddress(owner as Address) !== getAddress(proof.recipient)) {
      throw new Error('Ticket owner does not match the Megastera Proof recipient.');
    }
    if (minted !== false) throw new Error('Ticket has already been minted into a Planet.');
  });
}

export function createDefaultEligibilityStore(
  config: Stage5Config,
  env: Record<string, string | undefined> = process.env,
): EligibilityStore {
  assertProductionDatabase(config, env);
  return config.databaseUrl
    ? new PrismaEligibilityStore(getPrismaClient(config.databaseUrl))
    : new FileEligibilityStore(config.storePath ?? '.data/megaplanets-stage5.json');
}

const defaultDependencies: Stage5Dependencies = {
  loadConfig: () => loadStage5Config(process.env),
  findTicket: findTicketFromReceipt,
  validateAuthority: validateTicketAuthority,
  prepare: prepareVoucher,
  getStore: (config) => createDefaultEligibilityStore(config),
  rateLimiter: createVoucherRateLimiter(),
  workLimiter: createVoucherWorkLimiter(),
  readiness: probeStage5Readiness,
  operations: createOperationalState({ role: 'api' }),
};

/** Creates the Stage 5 API without exposing server secrets to browser code. */
export function createApp(
  overrides: Partial<Stage5Dependencies> = {},
  stage2Overrides: Partial<Stage2Dependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const app = new Hono();
  const inFlightPreparations = new Map<string, Promise<PreparedVoucher>>();

  app.use('*', createCorsMiddleware());

  app.use('*', async (c, next) => {
    await next();
    dependencies.operations.recordHttpRequest(c.res.status);
    return c.res;
  });

  app.get('/api/planets/health', (c) => c.json({ ok: true, stage: 5 }));

  app.get('/api/planets/metrics', (c) =>
    c.json({
      ok: true,
      service: 'api',
      operations: dependencies.operations.snapshot(),
    }),
  );

  app.get('/api/planets/megastera-proofs', async (c) => {
    const recipient = c.req.query('recipient');
    const pagination = parseProofPagination(c);
    if (!recipient || !isAddress(recipient) || !pagination) {
      return c.json({ error: 'recipient and bounded pagination are required.' }, 400);
    }
    try {
      const config = dependencies.loadConfig();
      const result = await dependencies
        .getStore(config)
        .listProofs(getAddress(recipient), pagination);
      return c.json({
        proofs: result.proofs.map(serializeMegasteraProof),
        total: result.total,
        offset: result.offset,
        limit: result.limit,
      });
    } catch {
      return c.json({ error: 'Megastera proof lookup is not configured.' }, 503);
    }
  });

  app.get('/api/planets/readiness', async (c) => {
    try {
      const config = dependencies.loadConfig();
      if (
        !config.databaseUrl ||
        !config.planetContractAddress ||
        config.planetDeploymentBlock === undefined ||
        !(await dependencies.readiness(config))
      ) {
        return c.json({ ready: false, stage: 5 }, 503);
      }
      return c.json({
        ready: true,
        stage: 5,
        chainId: 84_532,
        contractAddress: config.planetContractAddress,
        deploymentBlock: config.planetDeploymentBlock.toString(),
      });
    } catch {
      return c.json({ ready: false, stage: 5 }, 503);
    }
  });

  /** Ordered compatibility-preserving batch wrapper. Each item is resolved by
   * the singular route, so durable proof/artifact/voucher caches make retries
   * idempotent while preserving the caller's input order. */
  app.post('/api/planets/vouchers/batch', async (c) => {
    let body: unknown;
    try {
      body = await readBoundedJson(c.req.raw);
    } catch {
      return c.json({ error: 'Request body is invalid or too large.' }, 400);
    }
    const references =
      body && typeof body === 'object' && Array.isArray((body as { proofs?: unknown }).proofs)
        ? (body as { proofs: unknown[] }).proofs
        : undefined;
    if (!references || references.length < 1 || references.length > 50)
      return c.json({ error: 'proofs must contain between 1 and 50 receipt references.' }, 400);
    const vouchers: unknown[] = [];
    for (let index = 0; index < references.length; index += 1) {
      const response = await app.request('/api/planets/vouchers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(references[index]),
      });
      if (!response.ok)
        return c.json(
          { error: 'Batch voucher preparation failed.', index, status: response.status },
          response.status as 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 503,
        );
      vouchers.push(await response.json());
    }
    return c.json({ vouchers }, 201);
  });

  app.post('/api/planets/vouchers', async (c) => {
    const id = requestId(c);
    let request: VoucherRequest | undefined;
    try {
      request = parseVoucherRequest(await readBoundedJson(c.req.raw));
    } catch {
      return voucherFailure(
        c,
        new VoucherServiceError(
          'request',
          'invalid_request',
          'Request body is invalid or too large.',
          400,
        ),
        id,
      );
    }
    if (!request)
      return voucherFailure(
        c,
        new VoucherServiceError(
          'request',
          'invalid_request',
          'transactionHash and a non-negative logIndex are required.',
          400,
        ),
        id,
      );
    // Never trust a caller-provided X-Forwarded-For value without a configured
    // proxy boundary. The local fallback is deliberately receipt-keyed and is
    // not a substitute for a durable shared limiter across replicas.
    if (
      !dependencies.rateLimiter.allows('global-voucher-work') ||
      !dependencies.rateLimiter.allows(request.transactionHash.toLowerCase())
    ) {
      return voucherFailure(
        c,
        new VoucherServiceError(
          'rate_limit',
          'rate_limited',
          'Too many voucher requests. Please retry shortly.',
          429,
        ),
        id,
      );
    }

    let config: Stage5Config;
    try {
      config = dependencies.loadConfig();
      assertProductionDatabase(config, process.env);
    } catch {
      return voucherFailure(
        c,
        new VoucherServiceError(
          'configuration',
          'service_not_configured',
          'Voucher service is not configured.',
          503,
        ),
        id,
      );
    }

    try {
      const requestKey = `${request.transactionHash.toLowerCase()}:${request.logIndex}`;
      let preparation = inFlightPreparations.get(requestKey);
      if (!preparation) {
        preparation = (async () => {
          let ticket: MegasteraProof;
          try {
            ticket = normalizeMegasteraProof(
              await withTimeout(dependencies.findTicket(config, request), 15_000, 'Receipt lookup'),
            );
          } catch {
            throw new VoucherServiceError(
              'receipt',
              'receipt_not_eligible',
              'Ticket is not eligible for a Planet voucher.',
              422,
            );
          }
          try {
            await withTimeout(
              dependencies.validateAuthority(config, ticket),
              10_000,
              'Ticket authority lookup',
            );
          } catch {
            throw new VoucherServiceError(
              'authority',
              'ticket_not_authorized',
              'Ticket is not eligible for a Planet voucher.',
              422,
            );
          }
          let store: EligibilityStore;
          try {
            store = dependencies.getStore(config);
          } catch {
            throw new VoucherServiceError(
              'storage',
              'storage_unavailable',
              'Voucher storage is unavailable.',
              503,
            );
          }
          let proof: MegasteraProof;
          let artifact: import('./store').PlanetArtifact | undefined;
          try {
            await store.saveProof(ticket);
            proof =
              (await store.getProof({
                transactionHash: ticket.originTxHash,
                logIndex: ticket.logIndex,
              })) ?? ticket;
            const cached = await store.getVoucher(
              proof.ticketId,
              proof.recipient,
              BigInt(Math.floor(Date.now() / 1_000)),
            );
            if (cached) return cached;
            const artifactKey = `${proof.originTxHash.toLowerCase()}:${proof.logIndex.toString()}`;
            artifact = await store.getArtifact?.(artifactKey);
          } catch {
            throw new VoucherServiceError(
              'storage',
              'storage_unavailable',
              'Voucher storage is unavailable.',
              503,
            );
          }
          let prepared: PreparedVoucher;
          try {
            prepared = await dependencies.workLimiter.run(() =>
              dependencies.prepare(config, proof, artifact),
            );
            if (prepared.voucher.recipient.toLowerCase() !== proof.recipient.toLowerCase())
              throw new Error('Voucher recipient does not match the TicketPurchased recipient.');
          } catch {
            throw new VoucherServiceError(
              'artifact',
              'artifact_unavailable',
              'Planet artifact is unavailable.',
              422,
            );
          }
          try {
            if (prepared.artifact) await store.saveArtifact?.(prepared.artifact);
            await store.saveVoucher(prepared);
          } catch {
            throw new VoucherServiceError(
              'storage',
              'storage_unavailable',
              'Voucher storage is unavailable.',
              503,
            );
          }
          return prepared;
        })();
        inFlightPreparations.set(requestKey, preparation);
        void preparation
          .finally(() => inFlightPreparations.delete(requestKey))
          .catch(() => undefined);
      }
      const prepared = await preparation;
      return c.json(serializePreparedVoucher(prepared), 201);
    } catch (error) {
      if (error instanceof VoucherServiceError) return voucherFailure(c, error, id);
      return voucherFailure(
        c,
        new VoucherServiceError(
          'receipt',
          'receipt_not_eligible',
          'Ticket is not eligible for a Planet voucher.',
          422,
        ),
        id,
      );
    }
  });

  app.route('/api', createStage2Routes(stage2Overrides));
  app.route(
    '/api/leaderboard',
    createLeaderboardRoutes({ finalize: ensureOverdueLeaderboardPeriodsFinalized }),
  );

  return app;
}

export default createApp();
