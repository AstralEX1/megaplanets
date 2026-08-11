import type { PlanetTicketStatus } from '@/hooks/usePlanetTicketStatuses';
import { UsdcAmount } from '@/components/common/UsdcAmount';

function ClockIcon() {
  return (
    <svg role="img" aria-label="Clock" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function PlanetTicketStatusLabel({ status }: { status: PlanetTicketStatus }) {
  if (status.kind === 'countdown') {
    return <span className="inline-flex items-center gap-1.5 tabular-nums"><ClockIcon />{status.time}</span>;
  }
  if (status.kind === 'drawing') return <>Drawing</>;
  if (status.kind === 'claim') return <>Claim (<UsdcAmount value={status.amount} unit={false} />)</>;
  if (status.kind === 'claimed') return <>Claimed (<UsdcAmount value={status.amount} unit={false} />)</>;
  if (status.kind === 'drawn') return <>Drawn</>;
  return <>Status unavailable</>;
}
