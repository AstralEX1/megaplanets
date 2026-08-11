export function AutomaticQuickPickSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 items-center justify-between gap-4 text-sm text-[var(--text-primary)]">
    <span>Automatic quick pick</span>
    <button type="button" role="switch" aria-label="Automatic quick pick" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="relative h-11 w-12 disabled:cursor-not-allowed disabled:opacity-60">
      <span aria-hidden="true" className={`absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 rounded-full border transition-colors ${checked ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border-strong)] bg-[var(--surface-hover)]'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </span>
    </button>
  </label>;
}
