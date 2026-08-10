import { useState } from 'react';
import { ApprovalButton } from '@/components/common/ApprovalButton';
import type { CustomTicket, TicketBounds } from '@/lib/tickets';
import { CoordinatesPanel } from './CoordinatesDisclosure';
import { ExploreButton } from './ExploreButton';
import { CompactPlanetDial } from './CompactPlanetDial';
import { StaticDepthStack } from './StaticDepthStack';

export function ExpeditionConfigurator({ quantity, total, bounds, manuallyEditedTickets, automaticQuickPick, disabled, approvalSpender, approvalAmount, onApproved, onQuantityChange, onAutomaticQuickPickChange, onTicketsChange, onExplore }: { quantity: number; total: bigint; bounds: TicketBounds | null; manuallyEditedTickets: readonly CustomTicket[]; automaticQuickPick: boolean; disabled: boolean; approvalSpender?: `0x${string}`; approvalAmount?: bigint; onApproved?: () => void; onQuantityChange: (value: number) => void; onAutomaticQuickPickChange: (value: boolean) => void; onTicketsChange: (tickets: readonly CustomTicket[]) => void; onExplore: () => void }) {
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  const coordinatesLabel = coordinatesOpen ? 'Close coordinates' : 'Open coordinates';

  return <section className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-6">
    <div className="flex w-full items-center justify-center">
      <div className="w-full max-w-[560px] shrink-0">
        <div className="flex flex-col items-center">
          <h1 className="text-center font-hud text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)]">Start an expedition!</h1>
          <StaticDepthStack quantity={quantity} />
          <div className="w-full pt-5"><CompactPlanetDial quantity={quantity} onChange={onQuantityChange} /></div>
          <div className="w-full pt-5">{approvalSpender !== undefined && approvalAmount !== undefined ? <ApprovalButton spender={approvalSpender} amount={approvalAmount} onApproved={onApproved}><ExploreButton quantity={quantity} total={total} disabled={disabled} onClick={onExplore} /></ApprovalButton> : <ExploreButton quantity={quantity} total={total} disabled={disabled} onClick={onExplore} />}</div>
        </div>
      </div>
      <button type="button" aria-label={coordinatesLabel} aria-expanded={coordinatesOpen} onClick={() => setCoordinatesOpen((open) => !open)} className={`hidden h-40 w-14 shrink-0 items-center justify-center bg-[var(--background)] text-4xl text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] md:flex ${coordinatesOpen ? 'border-l border-[var(--border)]' : ''}`}>
        <span aria-hidden>{coordinatesOpen ? '‹' : '›'}</span>
      </button>
      <div className={`hidden shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-out md:block ${coordinatesOpen ? 'opacity-100' : 'opacity-0'}`} style={{ width: coordinatesOpen ? 430 : 0 }}>
        {coordinatesOpen && <CoordinatesPanel quantity={quantity} bounds={bounds} manuallyEditedTickets={manuallyEditedTickets} automaticQuickPick={automaticQuickPick} onAutomaticQuickPickChange={onAutomaticQuickPickChange} onTicketsChange={onTicketsChange} />}
      </div>
    </div>
    <div className="mt-5 w-full md:hidden">
      <button type="button" aria-label={coordinatesLabel} aria-expanded={coordinatesOpen} onClick={() => setCoordinatesOpen((open) => !open)} className="flex min-h-12 w-full items-center justify-between border-t border-[var(--border)] pt-3 font-hud text-sm font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]"><span>{coordinatesOpen ? '⌄ Hide coordinates' : '› Choose coordinates'}</span><span className="text-xs normal-case tracking-normal text-[var(--text-secondary)]">Optional</span></button>
      {coordinatesOpen && <div className="mt-3 border border-[var(--border-strong)]"><CoordinatesPanel quantity={quantity} bounds={bounds} manuallyEditedTickets={manuallyEditedTickets} automaticQuickPick={automaticQuickPick} onAutomaticQuickPickChange={onAutomaticQuickPickChange} onTicketsChange={onTicketsChange} /></div>}
    </div>
  </section>;
}
