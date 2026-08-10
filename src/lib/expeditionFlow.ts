import type { ExpeditionStep } from '@/components/expedition/ExpeditionSteps';

/**
 * Pure mapping from verifiable purchase state to presentation state.
 * It deliberately contains no timers or random result generation.
 */
export type ExpeditionScene =
  | 'configure'
  | 'wallet-confirmation'
  | 'confirming-purchase'
  | 'finalizing-direct-purchase'
  | 'awaiting-bulk-issuance'
  | 'signals-located';

export type ExpeditionFlowInput = {
  confirmedTicketCount: number;
  isBulkOrder: boolean;
  isWaitingSignature: boolean;
  isMiningPurchase: boolean;
  isPurchaseConfirmed: boolean;
};

export function deriveExpeditionFlow(input: ExpeditionFlowInput): {
  step: ExpeditionStep;
  scene: ExpeditionScene;
} {
  if (input.confirmedTicketCount > 0) return { step: 'reveal', scene: 'signals-located' };
  if (input.isWaitingSignature) return { step: 'explore', scene: 'wallet-confirmation' };
  if (input.isMiningPurchase) return { step: 'explore', scene: 'confirming-purchase' };
  if (input.isPurchaseConfirmed) {
    return input.isBulkOrder
      ? { step: 'explore', scene: 'awaiting-bulk-issuance' }
      : { step: 'explore', scene: 'finalizing-direct-purchase' };
  }
  return { step: 'configure', scene: 'configure' };
}
