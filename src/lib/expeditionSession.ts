import type { CustomTicket } from './tickets';

export type ExpeditionSessionV1 = {
  version: 1;
  account: `0x${string}`;
  chainId: number;
  purchaseMode: 'direct' | 'bulk';
  drawingId: string;
  quantity: number;
  automaticQuickPick: boolean;
  coordinates: readonly CustomTicket[];
  purchaseTxHash: `0x${string}` | null;
  bulkOrderReference: `0x${string}` | null;
  createdAt: number;
};

const keyFor = (account: string, chainId: number) =>
  `megaplanets:expedition:v1:${chainId}:${account.toLowerCase()}`;
const isHash = (value: unknown): value is `0x${string}` =>
  typeof value === 'string' && /^0x[\da-f]{64}$/i.test(value);

function isSession(value: unknown): value is ExpeditionSessionV1 {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ExpeditionSessionV1>;
  return (
    item.version === 1 &&
    typeof item.account === 'string' &&
    /^0x[\da-f]{40}$/i.test(item.account) &&
    Number.isSafeInteger(item.chainId) &&
    (item.purchaseMode === 'direct' || item.purchaseMode === 'bulk') &&
    typeof item.drawingId === 'string' &&
    /^\d+$/.test(item.drawingId) &&
    Number.isSafeInteger(item.quantity) &&
    (item.quantity ?? 0) >= 1 &&
    (item.quantity ?? 0) <= 50 &&
    typeof item.automaticQuickPick === 'boolean' &&
    Array.isArray(item.coordinates) &&
    (item.purchaseTxHash === null || isHash(item.purchaseTxHash)) &&
    (item.bulkOrderReference === null || isHash(item.bulkOrderReference)) &&
    typeof item.createdAt === 'number'
  );
}

export function writeExpeditionSession(session: ExpeditionSessionV1) {
  localStorage.setItem(keyFor(session.account, session.chainId), JSON.stringify(session));
}

export function readExpeditionSession(
  account: string,
  chainId: number,
): ExpeditionSessionV1 | null {
  try {
    const raw = localStorage.getItem(keyFor(account, chainId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) return null;
    if (parsed.account.toLowerCase() !== account.toLowerCase() || parsed.chainId !== chainId)
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearExpeditionSession(account: string, chainId: number) {
  localStorage.removeItem(keyFor(account, chainId));
}
