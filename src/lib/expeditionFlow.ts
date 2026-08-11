import type { ExpeditionStep } from '@/components/expedition/ExpeditionSteps';

const MIN_EXPEDITION_QUANTITY = 1;
const MAX_EXPEDITION_QUANTITY = 50;

export function clampExpeditionQuantity(value: number) {
  const finiteValue = Number.isFinite(value) ? Math.trunc(value) : MIN_EXPEDITION_QUANTITY;
  return Math.min(MAX_EXPEDITION_QUANTITY, Math.max(MIN_EXPEDITION_QUANTITY, finiteValue));
}

export type ExpeditionScene =
  | 'configure'
  | 'wallet-confirmation'
  | 'confirming-purchase'
  | 'discovering-planets'
  | 'verifying-tickets'
  | 'signals-located'
  | 'reveal-wallet-confirmation'
  | 'confirming-reveal'
  | 'results'
  | 'recoverable-error';

export type RevealFlowState = 'idle' | 'wallet-confirmation' | 'confirming' | 'complete' | 'error';

export type ExpeditionFlowInput = {
  isActive: boolean;
  expectedTicketCount: number;
  confirmedTicketCount: number;
  isBulkOrder: boolean;
  isWaitingSignature: boolean;
  isMiningPurchase: boolean;
  isPurchaseConfirmed: boolean;
  revealState: RevealFlowState;
  error: Error | null;
};

/** Maps only hook/receipt-derived facts to presentation state. */
export function deriveExpeditionFlow(input: ExpeditionFlowInput): {
  step: ExpeditionStep;
  scene: ExpeditionScene;
} {
  if (!input.isActive) return { step: 'configure', scene: 'configure' };
  if (input.revealState === 'complete') return { step: 'reveal', scene: 'results' };
  if (input.revealState === 'error') return { step: 'reveal', scene: 'recoverable-error' };
  if (input.revealState === 'confirming') return { step: 'reveal', scene: 'confirming-reveal' };
  if (input.revealState === 'wallet-confirmation')
    return { step: 'reveal', scene: 'reveal-wallet-confirmation' };
  if (input.error) return { step: 'explore', scene: 'recoverable-error' };
  if (input.isWaitingSignature) return { step: 'explore', scene: 'wallet-confirmation' };
  if (input.isMiningPurchase) return { step: 'explore', scene: 'confirming-purchase' };
  const hasAllTickets =
    input.expectedTicketCount > 0 && input.confirmedTicketCount >= input.expectedTicketCount;
  if (hasAllTickets) return { step: 'reveal', scene: 'signals-located' };
  if (input.isPurchaseConfirmed) {
    return input.isBulkOrder
      ? { step: 'discover', scene: 'discovering-planets' }
      : { step: 'discover', scene: 'verifying-tickets' };
  }
  return { step: 'explore', scene: 'wallet-confirmation' };
}
