export type TicketLifecycleStatus = 'claim' | 'claimed' | 'drawn' | string;

export function canClaimTicket(args: {
  revealed: boolean;
  status: TicketLifecycleStatus;
}): boolean {
  return args.revealed && args.status === 'claim';
}

export function claimBeforeRevealMessage(): string {
  return 'Reveal this planet before claiming the ticket prize.';
}
