export function TicketSummary({ manualCount, automaticCount }: { manualCount: number; automaticCount: number }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
    <span>{manualCount} manually selected</span><span>{automaticCount} automatic quick pick{automaticCount === 1 ? '' : 's'}</span>
  </div>;
}
