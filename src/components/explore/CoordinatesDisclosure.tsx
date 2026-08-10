import { useState } from 'react';
import { TicketPicker } from '@/components/lottery/TicketPicker';
import { MAX_CUSTOM_TICKETS, randomTicket, type CustomTicket, type TicketBounds } from '@/lib/tickets';
import { AutomaticQuickPickSwitch } from './AutomaticQuickPickSwitch';
import { ManualTicketRow } from './ManualTicketRow';
import { TicketSummary } from './TicketSummary';

export function CoordinatesPanel({ quantity, bounds, manuallyEditedTickets, automaticQuickPick, onAutomaticQuickPickChange, onTicketsChange }: { quantity: number; bounds: TicketBounds | null; manuallyEditedTickets: readonly CustomTicket[]; automaticQuickPick: boolean; onAutomaticQuickPickChange: (value: boolean) => void; onTicketsChange: (tickets: readonly CustomTicket[]) => void }) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const isBulk = quantity > MAX_CUSTOM_TICKETS;
  const manualLimit = Math.min(quantity, MAX_CUSTOM_TICKETS);
  const automaticCount = Math.max(0, quantity - manuallyEditedTickets.length);
  const updateTicket = (index: number, ticket: CustomTicket) => onTicketsChange(manuallyEditedTickets.map((current, currentIndex) => currentIndex === index ? ticket : current));
  const addTicket = () => {
    if (!bounds || manuallyEditedTickets.length >= manualLimit) return;
    onTicketsChange([...manuallyEditedTickets, randomTicket(bounds)]);
  };
  const shuffle = () => {
    if (!bounds) return;
    onTicketsChange(Array.from({ length: manualLimit }, () => randomTicket(bounds)));
    onAutomaticQuickPickChange(quantity > MAX_CUSTOM_TICKETS);
  };

  return <section aria-label="Coordinates" className="w-full bg-[var(--surface)] px-5 py-6 md:w-[430px] md:border-l md:border-[var(--border-strong)]">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-hud text-lg font-bold text-[var(--text-primary)]">Coordinates</h2>
      <button type="button" onClick={shuffle} disabled={!bounds} className="h-8 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 telemetry font-bold text-[var(--rare)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50">Shuffle</button>
    </div>
    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
      <div className="grid grid-cols-[minmax(42px,1fr)_4.5fr] gap-2 border-b border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2.5 telemetry text-[9px] text-[var(--text-secondary)]">
        <span>TKT</span><span className="text-center">01 · 02 · 03 · 04 · 05 · BONUS</span>
      </div>
      {manuallyEditedTickets.length > 0 ? manuallyEditedTickets.map((ticket, index) => <ManualTicketRow
        // biome-ignore lint/suspicious/noArrayIndexKey: ticket slots are positional and duplicate combinations are valid purchases
        key={`${index}-${ticket.normals.join('-')}-${ticket.bonusball}`}
        ticket={ticket}
        index={index}
        onEdit={() => setEditingIndex(index)}
        onRemove={() => onTicketsChange(manuallyEditedTickets.filter((_, currentIndex) => currentIndex !== index))}
      />) : <p className="px-3 py-6 text-center text-sm text-[var(--text-secondary)]">Use Shuffle or add a ticket to choose coordinates.</p>}
    </div>
    <div className="mt-4 space-y-3">
      <AutomaticQuickPickSwitch checked={automaticQuickPick} disabled={isBulk} onChange={onAutomaticQuickPickChange} />
      {!isBulk && manuallyEditedTickets.length < manualLimit && <button type="button" onClick={addTicket} disabled={!bounds} className="min-h-11 rounded-lg border border-[var(--rare)] px-3 text-sm font-semibold text-[var(--rare)] transition-colors hover:bg-[var(--rare)]/10 disabled:cursor-not-allowed disabled:opacity-50">+ Add manual ticket</button>}
      <TicketSummary manualCount={manuallyEditedTickets.length} automaticCount={automaticCount} />
      {automaticCount > 0 && <p className="text-xs leading-5 text-[var(--text-secondary)]">Quick picks are generated with the current drawing limits when your purchase is submitted.</p>}
    </div>
    {bounds && editingIndex !== null && manuallyEditedTickets[editingIndex] && <TicketPicker open onClose={() => setEditingIndex(null)} onSave={(ticket) => { updateTicket(editingIndex, ticket); setEditingIndex(null); }} ticket={manuallyEditedTickets[editingIndex]} bounds={bounds} index={editingIndex} total={manuallyEditedTickets.length} />}
  </section>;
}
