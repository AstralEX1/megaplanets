import { Ball } from '@/components/lottery/Ball';
import type { CustomTicket } from '@/lib/tickets';

export function ManualTicketRow({ ticket, index, onEdit, onRemove }: { ticket: CustomTicket; index: number; onEdit: () => void; onRemove: () => void }) {
  return <div className="flex min-h-14 items-center gap-2 border-b border-[var(--border)] py-2 last:border-b-0">
    <span className="w-16 shrink-0 font-mono text-xs text-[var(--text-secondary)]">TICKET {String(index + 1).padStart(2, '0')}</span>
    <button type="button" onClick={onEdit} className="cursor-target flex min-w-0 flex-1 items-center gap-1" aria-label={`Edit ticket ${index + 1}`}>
      {ticket.normals.map((number) => <Ball key={number} n={String(number).padStart(2, '0')} size="sm" />)}
      <Ball n={String(ticket.bonusball).padStart(2, '0')} variant="bonus" size="sm" />
    </button>
    <button type="button" onClick={onRemove} className="cursor-target min-h-11 px-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--danger)]">Remove</button>
  </div>;
}
