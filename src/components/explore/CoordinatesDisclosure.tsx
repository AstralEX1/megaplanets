import { useState } from 'react';
import { TicketPicker } from '@/components/lottery/TicketPicker';
import { MAX_CUSTOM_TICKETS, randomTicket, type CustomTicket, type TicketBounds } from '@/lib/tickets';
import { AutomaticQuickPickSwitch } from './AutomaticQuickPickSwitch';
import { ManualTicketRow } from './ManualTicketRow';
import { TicketSummary } from './TicketSummary';

export function CoordinatesDisclosure({ quantity, bounds, manuallyEditedTickets, automaticQuickPick, onAutomaticQuickPickChange, onTicketsChange }: { quantity: number; bounds: TicketBounds | null; manuallyEditedTickets: readonly CustomTicket[]; automaticQuickPick: boolean; onAutomaticQuickPickChange: (value: boolean) => void; onTicketsChange: (tickets: readonly CustomTicket[]) => void }) {
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const isBulk = quantity > MAX_CUSTOM_TICKETS;
  const manualLimit = Math.min(quantity, MAX_CUSTOM_TICKETS);
  const automaticCount = Math.max(0, quantity - manuallyEditedTickets.length);
  const addTicket = () => {
    if (!bounds || manuallyEditedTickets.length >= manualLimit) return;
    onTicketsChange([...manuallyEditedTickets, randomTicket(bounds)]);
  };
  const updateTicket = (index: number, ticket: CustomTicket) => onTicketsChange(manuallyEditedTickets.map((current, currentIndex) => currentIndex === index ? ticket : current));

  return <section className="border-t border-[var(--border)] pt-2">
    <button type="button" aria-label="Choose coordinates" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-12 w-full items-center justify-between font-hud text-sm font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]">
      <span>{open ? '⌄' : '›'} Choose coordinates</span><span className="text-xs normal-case tracking-normal text-[var(--text-secondary)]">Optional</span>
    </button>
    {open && <div className="space-y-3 pb-1 pt-2">
      <AutomaticQuickPickSwitch checked={automaticQuickPick} disabled={isBulk} onChange={onAutomaticQuickPickChange} />
      {isBulk && <p className="text-xs leading-5 text-[var(--text-secondary)]">Large orders use the existing Megapot keeper route. Numbers are issued after the order is confirmed.</p>}
      {manuallyEditedTickets.map((ticket, index) => <ManualTicketRow
        // biome-ignore lint/suspicious/noArrayIndexKey: ticket slots are positional; duplicate number combinations are valid purchases
        key={`${index}-${ticket.normals.join('-')}-${ticket.bonusball}`}
        ticket={ticket} index={index} onEdit={() => setEditingIndex(index)} onRemove={() => onTicketsChange(manuallyEditedTickets.filter((_, currentIndex) => currentIndex !== index))}
      />)}
      {!isBulk && manuallyEditedTickets.length < manualLimit && <button type="button" onClick={addTicket} disabled={!bounds} className="min-h-11 rounded-lg border border-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:cursor-not-allowed disabled:opacity-50">+ Add manual ticket</button>}
      <TicketSummary manualCount={manuallyEditedTickets.length} automaticCount={automaticCount} />
      {automaticCount > 0 && <p className="text-xs text-[var(--text-secondary)]">Quick picks are generated with the current drawing limits when your purchase is submitted.</p>}
      {bounds && editingIndex !== null && manuallyEditedTickets[editingIndex] && <TicketPicker open onClose={() => setEditingIndex(null)} onSave={(ticket) => { updateTicket(editingIndex, ticket); setEditingIndex(null); }} ticket={manuallyEditedTickets[editingIndex]} bounds={bounds} index={editingIndex} total={manuallyEditedTickets.length} />}
    </div>}
  </section>;
}
