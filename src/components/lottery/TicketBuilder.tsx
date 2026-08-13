import { useMemo, useState } from 'react';
import { Ball } from '@/components/lottery/Ball';
import { TicketPicker } from '@/components/lottery/TicketPicker';
import { type CustomTicket, isValidTicket, MAX_CUSTOM_TICKETS, randomTicket } from '@/lib/tickets';

/**
 * Custom tickets are optional and all remaining
 * direct slots are client-generated quick-picks at checkout. Bulk random slots are
 * keeper-generated, so they deliberately have no final numbers client-side.
 */
export function TicketBuilder({
  ballMax,
  bonusballMax,
  count,
  staticTickets,
  onStaticTicketsChange,
}: {
  ballMax: number | undefined;
  bonusballMax: number | undefined;
  count: number;
  staticTickets: readonly CustomTicket[];
  onStaticTicketsChange: (tickets: readonly CustomTicket[]) => void;
}) {
  const [pickerOpenIndex, setPickerOpenIndex] = useState<number | null>(null);
  const bounds = useMemo(
    () => (ballMax !== undefined && bonusballMax !== undefined ? { ballMax, bonusballMax } : null),
    [ballMax, bonusballMax],
  );
  const isBulk = count > MAX_CUSTOM_TICKETS;
  const customCount = staticTickets.length;
  const randomCount = Math.max(0, count - customCount);

  const addStatic = () => {
    if (!bounds || staticTickets.length >= MAX_CUSTOM_TICKETS) return;
    onStaticTicketsChange([...staticTickets, randomTicket(bounds)]);
  };

  const updateStatic = (index: number, next: CustomTicket) => {
    onStaticTicketsChange(
      staticTickets.map((ticket, current) => (current === index ? next : ticket)),
    );
  };

  const removeStatic = (index: number) => {
    onStaticTicketsChange(staticTickets.filter((_, current) => current !== index));
  };

  const shuffleAll = () => {
    if (!bounds) return;
    onStaticTicketsChange(Array.from({ length: count }, () => randomTicket(bounds)));
  };

  if (isBulk) {
    return (
      <p className="rounded-2xl border border-[#5968aa] bg-[#151c43] px-4 py-3 text-center text-xs text-[#c6d0ff]">
        Numbers are picked randomly by the Megapot keeper for 11+ tickets.
      </p>
    );
  }

  return (
    <details open className="rounded-2xl border border-[#3b467c] bg-[#0c1028] p-4">
      <summary className="cursor-pointer list-none text-center text-base font-semibold text-[#f4f7ff] marker:content-none">
        Choose numbers <span className="ml-1 text-[#98a8ed]">⌃</span>
      </summary>
      <p className="mt-2 text-center text-xs text-[#9eabd8]">
        {customCount} custom · {randomCount} client quick-pick
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={shuffleAll}
          disabled={!bounds}
          className="rounded-full border border-[#526098] px-3 py-2 text-xs font-semibold text-[#dbe5ff] hover:bg-[#202a58] disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↻ Shuffle
        </button>
        <button
          type="button"
          onClick={() => onStaticTicketsChange([])}
          disabled={staticTickets.length === 0}
          className="rounded-full border border-[#526098] px-3 py-2 text-xs font-semibold text-[#dbe5ff] hover:bg-[#202a58] disabled:cursor-not-allowed disabled:opacity-50"
        >
          ◇ Clear
        </button>
        {staticTickets.length < Math.min(MAX_CUSTOM_TICKETS, count) && (
          <button
            type="button"
            onClick={addStatic}
            disabled={!bounds}
            className="ml-auto rounded-full border border-[#526098] px-3 py-2 text-xs font-semibold text-[#dbe5ff] hover:bg-[#202a58] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {staticTickets.map((ticket, index) => (
          <StaticTicketRow
            // biome-ignore lint/suspicious/noArrayIndexKey: ticket slots are positional and duplicate number combinations are valid purchases
            key={`${index}-${ticket.normals.join('-')}-${ticket.bonusball}`}
            ticket={ticket}
            bounds={bounds}
            onEdit={() => setPickerOpenIndex(index)}
            onRemove={() => removeStatic(index)}
          />
        ))}
        {randomCount > 0 && (
          <p className="rounded-xl border border-[#3b467c] bg-[#131a3b] px-3 py-2 text-xs text-[#cbd5ff]">
            {randomCount} ticket{randomCount === 1 ? '' : 's'} will use a valid client-side
            quick-pick.
          </p>
        )}
      </div>

      {bounds && pickerOpenIndex !== null && staticTickets[pickerOpenIndex] && (
        <TicketPicker
          open
          onClose={() => setPickerOpenIndex(null)}
          onSave={(next) => {
            updateStatic(pickerOpenIndex, next);
            setPickerOpenIndex(null);
          }}
          ticket={staticTickets[pickerOpenIndex]}
          bounds={bounds}
          index={pickerOpenIndex}
          total={staticTickets.length}
        />
      )}
    </details>
  );
}

function StaticTicketRow({
  ticket,
  bounds,
  onEdit,
  onRemove,
}: {
  ticket: CustomTicket;
  bounds: { ballMax: number; bonusballMax: number } | null;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const valid = bounds ? isValidTicket(ticket, bounds) : true;
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${valid ? 'border-zinc-200 dark:border-zinc-800' : 'border-rose-500'}`}
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-1 text-left"
      >
        {ticket.normals.map((number) => (
          <Ball key={number} n={number} size="sm" />
        ))}
        <span className="px-0.5 text-[11px] text-zinc-400">+</span>
        <Ball n={ticket.bonusball} variant="bonus" size="sm" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-rose-600 dark:hover:bg-zinc-800"
      >
        Remove
      </button>
    </div>
  );
}
