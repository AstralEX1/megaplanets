import { useState } from 'react';
import { TicketPicker } from '@/components/lottery/TicketPicker';
import { MAX_CUSTOM_TICKETS, randomTicket, type CustomTicket, type TicketBounds } from '@/lib/tickets';
import { AutomaticQuickPickSwitch } from './AutomaticQuickPickSwitch';
import { ManualTicketRow } from './ManualTicketRow';
import { TicketSummary } from './TicketSummary';

function QuickPickTicketRow({ index }: { index: number }) {
  return <div
    data-testid="quick-pick-ticket"
    data-ticket-index={index + 1}
    className="ticket-row-enter flex min-h-14 items-center gap-2 border-b border-[var(--border)] px-3 py-2 last:border-b-0"
    style={{ animationDelay: `${index * 40}ms` }}
  >
    <span className="w-16 shrink-0 font-mono text-xs text-[var(--text-secondary)]">TICKET {String(index + 1).padStart(2, '0')}</span>
    <div role="img" className="flex min-w-0 flex-1 items-center gap-1" aria-label={`Quick pick ticket ${index + 1}`}>
      {['normal-1', 'normal-2', 'normal-3', 'normal-4', 'normal-5'].map((slot) => <span key={slot} aria-hidden className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--surface)] font-mono text-[10px] text-[var(--text-disabled)]">?</span>)}
      <span aria-hidden className="mx-0.5 h-5 w-px bg-[var(--border-strong)]" />
      <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-[var(--rare)] bg-[color:color-mix(in_srgb,var(--rare)_10%,transparent)] font-mono text-[10px] text-[var(--rare)]">?</span>
    </div>
    <span className="telemetry text-[9px] font-bold text-[var(--rare)]">Quick pick</span>
  </div>;
}

export function CoordinatesPanel({ quantity, bounds, manuallyEditedTickets, automaticQuickPick, onAutomaticQuickPickChange, onTicketsChange }: { quantity: number; bounds: TicketBounds | null; manuallyEditedTickets: readonly CustomTicket[]; automaticQuickPick: boolean; onAutomaticQuickPickChange: (value: boolean) => void; onTicketsChange: (tickets: readonly CustomTicket[]) => void }) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const isBulk = quantity > MAX_CUSTOM_TICKETS;
  const manualLimit = Math.min(quantity, MAX_CUSTOM_TICKETS);
  const automaticCount = automaticQuickPick || isBulk ? Math.max(0, quantity - manuallyEditedTickets.length) : 0;
  const automaticSlots = Array.from({ length: automaticCount }, (_, offset) => {
    const index = manuallyEditedTickets.length + offset;
    return { id: `quick-pick-slot-${index + 1}`, index };
  });
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

  return <section aria-label="Coordinates" className="w-full bg-[var(--surface)] px-5 py-6 md:border-l md:border-[var(--border-strong)]">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-hud text-lg font-bold text-[var(--text-primary)]">Coordinates</h2>
      <button type="button" onClick={shuffle} disabled={!bounds} className="h-8 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 telemetry font-bold text-[var(--rare)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50">Shuffle</button>
    </div>
    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
      <div className="grid grid-cols-[minmax(42px,1fr)_4.5fr] gap-2 border-b border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2.5 telemetry text-[9px] text-[var(--text-secondary)]">
        <span>TKT</span><span className="text-center">01 · 02 · 03 · 04 · 05 · BONUS</span>
      </div>
      {manuallyEditedTickets.map((ticket, index) => <ManualTicketRow
        // biome-ignore lint/suspicious/noArrayIndexKey: ticket slots are positional and duplicate combinations are valid purchases
        key={`${index}-${ticket.normals.join('-')}-${ticket.bonusball}`}
        ticket={ticket}
        index={index}
        onEdit={() => setEditingIndex(index)}
        onRemove={() => onTicketsChange(manuallyEditedTickets.filter((_, currentIndex) => currentIndex !== index))}
      />)}
      {automaticSlots.map((slot) => <QuickPickTicketRow key={slot.id} index={slot.index} />)}
      {manuallyEditedTickets.length === 0 && automaticCount === 0 ? <p className="px-3 py-6 text-center text-sm text-[var(--text-secondary)]">Use Shuffle or add a ticket to choose coordinates.</p> : null}
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
