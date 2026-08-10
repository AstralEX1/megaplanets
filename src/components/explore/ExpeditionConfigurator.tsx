import type { CustomTicket, TicketBounds } from '@/lib/tickets';
import { CompactPlanetDial } from './CompactPlanetDial';
import { CoordinatesDisclosure } from './CoordinatesDisclosure';
import { ExploreButton } from './ExploreButton';
import { QuantityPresets, type QuantityPreset } from './QuantityPresets';
import { QuantityStepper } from './QuantityStepper';

export type ConfiguratorState = { quantity: number; selectedPreset: QuantityPreset; coordinatesOpen: boolean; automaticQuickPick: boolean; manuallyEditedTickets: readonly CustomTicket[] };

export function ExpeditionConfigurator({ quantity, selectedPreset, total, bounds, manuallyEditedTickets, automaticQuickPick, disabled, onQuantityChange, onPresetChange, onAutomaticQuickPickChange, onTicketsChange, onExplore }: { quantity: number; selectedPreset: QuantityPreset; total: bigint; bounds: TicketBounds | null; manuallyEditedTickets: readonly CustomTicket[]; automaticQuickPick: boolean; disabled: boolean; onQuantityChange: (value: number) => void; onPresetChange: (preset: Exclude<QuantityPreset, null>) => void; onAutomaticQuickPickChange: (value: boolean) => void; onTicketsChange: (tickets: readonly CustomTicket[]) => void; onExplore: () => void }) {
  return <section className="mx-auto w-full max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
    <p className="mb-1 text-center font-hud text-xs font-bold tracking-[0.14em] text-[var(--text-secondary)]">SELECT EXPEDITION</p>
    <CompactPlanetDial quantity={quantity} onChange={onQuantityChange} />
    <div className="space-y-3"><QuantityPresets quantity={quantity} selectedPreset={selectedPreset} onSelect={onPresetChange} onQuantityChange={onQuantityChange} /><QuantityStepper quantity={quantity} onChange={onQuantityChange} /><ExploreButton quantity={quantity} total={total} disabled={disabled} onClick={onExplore} /><CoordinatesDisclosure quantity={quantity} bounds={bounds} manuallyEditedTickets={manuallyEditedTickets} automaticQuickPick={automaticQuickPick} onAutomaticQuickPickChange={onAutomaticQuickPickChange} onTicketsChange={onTicketsChange} /></div>
  </section>;
}
