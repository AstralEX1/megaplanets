# My Planets Expanded Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the selected My Planets detail around the supplied reference with a mining overlay, contextual ticket lifecycle, always-visible details, canonical BaseScan links, and a ticket-only unrevealed state.

**Architecture:** Keep `Planets` as the data-composition boundary and `PlanetInventoryDetail` as the shared desktop/mobile presentation. Add a focused `PlanetMiningOverlay` component for backend mining state, extend the chain-aware explorer configuration with an NFT prefix, and pass canonical purchase provenance into the detail without adding endpoints or changing write flows.

**Tech Stack:** React, TypeScript, wagmi, viem, Tailwind CSS, Vitest, Testing Library, Vite, pnpm.

## Global Constraints

- Preserve the existing palette tokens, responsive list-detail routing, GIF worker, ticket provenance, mining backend, and claim receipt/refetch flow.
- Do not change ticket purchases, approvals, vouchers, minting, indexer behavior, mining calculations, or contract writes.
- Keep Base Sepolia, `MEGAPLANETS_V1`, bigint values, and receipt-confirmed transactions unchanged.
- An unrevealed item may show only Ticket ID, purchased coordinates, lifecycle state, Ticket BaseScan link, and the existing Mint action.
- Never render or derive unrevealed artwork, name, type, minerals, rarity, terrain, clouds, satellites, rings, mining rate, same-type bonus, or other deterministic traits.
- Only `Claim ($X)` is interactive. Countdown, Drawing, Claimed, Drawn, and unavailable lifecycle values are displays, not navigation controls.
- Preserve unrelated and pre-existing working-tree changes. Before any commit, inspect the complete staged diff; if a target file contains unrelated changes that cannot be separated safely, leave the task uncommitted and report it instead of committing user work.
- Use pnpm. Required verification is `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

---

## File Structure

- Create `src/assets/mine-icon.png`: supplied monochrome mine glyph.
- Create `src/assets/same-type-icon.png`: supplied monochrome same-type glyph.
- Create `src/components/planets/PlanetMiningOverlay.tsx`: renders the three backend-backed overlay metrics and explicit unavailable state.
- Create `src/components/planets/PlanetMiningOverlay.test.tsx`: verifies metric mapping and unavailable behavior.
- Modify `src/config/contracts.ts`: export the active-chain NFT explorer prefix.
- Modify `src/config/contracts.test.ts`: verify Base Sepolia NFT URL construction.
- Modify `src/components/planets/PlanetInventoryDetail.tsx`: rebuild revealed/unrevealed layouts, details grid, explorer links, and claim-only control.
- Modify `src/components/planets/PlanetInventoryDetail.test.tsx`: verify reference content, privacy, links, and interactions.
- Modify `src/pages/Planets.tsx`: pass purchase transaction provenance and narrow the lifecycle callback to claims.
- Modify `src/pages/Planets.test.tsx`: verify real ticket/NFT links, claim behavior, and unrevealed integration.

---

### Task 1: Mining overlay assets and component

**Files:**
- Create: `src/assets/mine-icon.png`
- Create: `src/assets/same-type-icon.png`
- Create: `src/components/planets/PlanetMiningOverlay.tsx`
- Create: `src/components/planets/PlanetMiningOverlay.test.tsx`

**Interfaces:**
- Consumes: `mining?: PlanetMiningSnapshot` and `miningAsOf?: string`.
- Produces: `PlanetMiningOverlay({ mining, miningAsOf })`, a responsive overlay containing base minerals/day, live mined total, and same-type bonus.

- [ ] **Step 1: Copy the two supplied icons into the repository**

Copy these files without transforming them:

```text
C:\Users\alexe\AppData\Local\Temp\codex-clipboard-62fa9ffe-2542-4439-9e7a-bbbb00edcd6d.png
  -> src/assets/mine-icon.png
C:\Users\alexe\AppData\Local\Temp\codex-clipboard-0ca55cd6-ad30-4b4c-ad42-37141b052342.png
  -> src/assets/same-type-icon.png
```

Both files are 512x512 transparent monochrome PNGs. Render them as CSS masks with `backgroundColor: 'var(--rare)'`; do not use `invert` or bake a new color into the images.

- [ ] **Step 2: Write the failing overlay tests**

Create `src/components/planets/PlanetMiningOverlay.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanetMiningOverlay } from './PlanetMiningOverlay';

const mining = {
  tokenId: '7',
  baseMineralsPerDay: '24',
  multiplierBps: '10500',
  effectiveMineralsPerDayMicros: '25200000',
  pendingMicros: '1000000',
  earnedMicros: '10100000',
  activeSince: '2026-08-10T00:00:00.000Z',
};

describe('PlanetMiningOverlay', () => {
  afterEach(cleanup);

  it('maps the backend mining snapshot into the three overlay metrics', () => {
    render(<PlanetMiningOverlay mining={mining} miningAsOf="2026-08-10T00:00:01.000Z" />);
    expect(screen.getByTestId('planet-mining-overlay')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Minerals' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mined' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Same type' })).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('MINERALS / DAY')).toBeInTheDocument();
    expect(screen.getByText(/Mined 10\.1/)).toBeInTheDocument();
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('does not invent mining values when the backend snapshot is unavailable', () => {
    render(<PlanetMiningOverlay />);
    expect(screen.getByText('Mining unavailable')).toBeInTheDocument();
    expect(screen.queryByText('+0%')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```powershell
pnpm test -- src/components/planets/PlanetMiningOverlay.test.tsx
```

Expected: FAIL because `./PlanetMiningOverlay` does not exist.

- [ ] **Step 4: Implement the minimal overlay component**

Create `src/components/planets/PlanetMiningOverlay.tsx` with this implementation:

```tsx
import type { CSSProperties } from 'react';
import mineIcon from '@/assets/mine-icon.png';
import mineralIcon from '@/assets/mineral-icon.png';
import sameTypeIcon from '@/assets/same-type-icon.png';
import type { PlanetMiningSnapshot } from '@/hooks/useWalletMining';
import { LiveMineralAmount } from './LiveMineralAmount';

type PlanetMiningOverlayProps = {
  mining?: PlanetMiningSnapshot;
  miningAsOf?: string;
};

function MaskIcon({ src, label }: { src: string; label: string }) {
  const style = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  } as CSSProperties;
  return <span role="img" aria-label={label} className="h-7 w-7 shrink-0 bg-[var(--rare)]" style={style} />;
}

export function PlanetMiningOverlay({ mining, miningAsOf }: PlanetMiningOverlayProps) {
  if (!mining || !miningAsOf) {
    return (
      <div data-testid="planet-mining-overlay" className="absolute inset-x-3 bottom-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)]/90 p-3 text-center backdrop-blur-md">
        <span className="telemetry text-[var(--text-secondary)]">Mining unavailable</span>
      </div>
    );
  }

  const sameTypeBonusPercent = (Number(mining.multiplierBps) - 10_000) / 100;
  return (
    <div data-testid="planet-mining-overlay" className="absolute inset-x-3 bottom-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)]/90 backdrop-blur-md sm:grid-cols-3">
      <div className="flex min-w-0 items-center gap-2 border-r border-[var(--border)] p-3">
        <img src={mineralIcon} alt="Minerals" className="h-7 w-7 shrink-0 object-contain invert" />
        <span className="min-w-0">
          <strong className="block font-hud text-lg text-[var(--text-primary)]">{mining.baseMineralsPerDay}</strong>
          <span className="telemetry block text-[var(--text-secondary)]">MINERALS / DAY</span>
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2 p-3 sm:border-r sm:border-[var(--border)]">
        <MaskIcon src={mineIcon} label="Mined" />
        <span className="min-w-0">
          <LiveMineralAmount
            prefix="Mined"
            snapshotMicros={mining.earnedMicros}
            effectiveMineralsPerDayMicros={mining.effectiveMineralsPerDayMicros}
            asOf={miningAsOf}
            className="block font-hud text-lg text-[var(--text-primary)]"
          />
          <span className="telemetry block text-[var(--text-secondary)]">MINED</span>
        </span>
      </div>
      <div className="col-span-2 flex min-w-0 items-center justify-center gap-2 border-t border-[var(--border)] p-3 sm:col-span-1 sm:justify-start sm:border-t-0">
        <MaskIcon src={sameTypeIcon} label="Same type" />
        <span className="min-w-0">
          <strong className="block font-hud text-lg text-[var(--text-primary)]">+{sameTypeBonusPercent}%</strong>
          <span className="telemetry block text-[var(--text-secondary)]">SAME TYPE</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
pnpm test -- src/components/planets/PlanetMiningOverlay.test.tsx
```

Expected: PASS with both tests green and no warnings.

- [ ] **Step 6: Review and checkpoint**

Run `git diff --check` and inspect all four Task 1 paths. If they contain only Task 1 work, commit with:

```powershell
git add -- src/assets/mine-icon.png src/assets/same-type-icon.png src/components/planets/PlanetMiningOverlay.tsx src/components/planets/PlanetMiningOverlay.test.tsx
git commit -m "feat: add planet mining overlay"
```

---

### Task 2: Chain-aware NFT explorer URL

**Files:**
- Modify: `src/config/contracts.ts:32-47`
- Modify: `src/config/contracts.test.ts:1-34`

**Interfaces:**
- Consumes: existing `EXPLORER_BASE[CHAIN]` and configured active chain.
- Produces: `EXPLORER_NFT_URL`, used as `${EXPLORER_NFT_URL}${contractAddress}/${tokenId}`.

- [ ] **Step 1: Add a failing contract configuration test**

Import `EXPLORER_NFT_URL` in `src/config/contracts.test.ts` and add:

```ts
it('builds NFT detail links for the active Base Sepolia explorer', () => {
  expect(`${EXPLORER_NFT_URL}0xabc/7`).toBe('https://sepolia.basescan.org/nft/0xabc/7');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm test -- src/config/contracts.test.ts
```

Expected: FAIL because `EXPLORER_NFT_URL` is not exported.

- [ ] **Step 3: Add the NFT prefix beside the existing explorer prefixes**

In `src/config/contracts.ts`, update the explorer comment with the NFT example and export:

```ts
/** Chain-resolved explorer URL prefix for individual ERC-721 tokens. Append contract/tokenId. */
export const EXPLORER_NFT_URL = `${EXPLORER_BASE[CHAIN]}nft/`;
```

Keep `EXPLORER_ADDRESS_URL` and `EXPLORER_TX_URL` unchanged. The `/nft/{contract}/{tokenId}` path is the BaseScan individual-token route.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
pnpm test -- src/config/contracts.test.ts
```

Expected: PASS with the protocol invariant tests unchanged.

- [ ] **Step 5: Review and checkpoint**

Run `git diff --check` and inspect both Task 2 paths. Commit only if their staged diff contains no unrelated work:

```powershell
git add -- src/config/contracts.ts src/config/contracts.test.ts
git commit -m "feat: add NFT explorer URL"
```

---

### Task 3: Rebuild the revealed detail and claim-only lifecycle control

**Files:**
- Modify: `src/components/planets/PlanetInventoryDetail.tsx:1-157`
- Modify: `src/components/planets/PlanetInventoryDetail.test.tsx:1-63`

**Interfaces:**
- Consumes: `preview`, `tokenId`, `ticketTxHash`, `ticketStatus`, `mining`, `miningAsOf`, `onClaim`, `onBack`, and configured explorer constants.
- Produces: revealed portrait layout with artwork overlay, ticket panel, claim-only action, always-visible details, and canonical explorer links.

- [ ] **Step 1: Extend the revealed-detail test with the approved behavior**

Update the fixture input to include:

```ts
originTxHash: `0x${'1'.repeat(64)}`,
```

Rename `onStatusAction` to `onClaim`, pass the fixture's 32-byte `originTxHash` through the `ticketTxHash` prop, and assert:

```tsx
expect(screen.getByTestId('planet-artwork')).toContainElement(screen.getByTestId('planet-mining-overlay'));
expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /Details/i })).not.toBeInTheDocument();
expect(screen.getByText('Base minerals')).toBeInTheDocument();
expect(screen.getByText('24', { selector: '[data-trait="base-minerals"]' })).toBeInTheDocument();
expect(screen.queryByText('Rings')).not.toBeInTheDocument();
expect(screen.getByRole('link', { name: 'Ticket BaseScan' })).toHaveAttribute(
  'href',
  `https://sepolia.basescan.org/tx/0x${'1'.repeat(64)}`,
);
expect(screen.getByRole('link', { name: 'NFT BaseScan' })).toHaveAttribute(
  'href',
  expect.stringMatching(/\/nft\/0xa94b947256fa977e63a7970cdf513fdd7632d744\/7$/i),
);
```

Retain the click assertion proving `Claim ($12.50)` calls `onClaim` once. Remove assertions for the old detached mining box, Effective rate row, Rings row, and `View details` action.

Add a separate non-claim test:

```tsx
it.each([
  [{ kind: 'countdown', time: '23:59:42' } as const, '23:59:42'],
  [{ kind: 'drawing' } as const, 'Drawing'],
  [{ kind: 'claimed', amount: 12_500_000n } as const, 'Claimed ($12.50)'],
  [{ kind: 'drawn' } as const, 'Drawn'],
])('renders %s as state without an action', (ticketStatus, label) => {
  render(<PlanetInventoryDetail preview={preview} tokenId="7" revealed ticketStatus={ticketStatus} mintAction={null} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm test -- src/components/planets/PlanetInventoryDetail.test.tsx
```

Expected: FAIL because the overlay is outside the artwork, Details has no heading/base-minerals row, explorer links are absent, and non-claim states are still buttons.

- [ ] **Step 3: Refactor the detail props and shared ticket state**

Change the props to:

```ts
type PlanetInventoryDetailProps = {
  preview: PlanetPreview;
  tokenId?: string;
  ticketTxHash?: string;
  revealed: boolean;
  ticketStatus: PlanetTicketStatus;
  mintAction: ReactNode;
  onClaim?: () => void;
  statusPending?: boolean;
  onBack?: () => void;
  mining?: PlanetMiningSnapshot;
  miningAsOf?: string;
};
```

Remove `onStatusAction` and `onViewDetails`. Add this `TicketLifecycle` helper so only a claimable ticket exposes an action:

```tsx
function TicketLifecycle({
  status,
  onClaim,
  pending,
}: {
  status: PlanetTicketStatus;
  onClaim?: () => void;
  pending: boolean;
}) {
  if (status.kind === 'claim') {
    return (
      <Button variant="primary" size="lg" className="w-full" disabled={pending} onClick={onClaim}>
        <PlanetTicketStatusLabel status={status} />
      </Button>
    );
  }
  return (
    <div data-ticket-lifecycle={status.kind} className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)]">
      <PlanetTicketStatusLabel status={status} />
    </div>
  );
}
```

Add an `ExplorerLink` helper with this behavior:

```tsx
function ExplorerLink({ href, label }: { href?: string; label: string }) {
  if (!href) {
    return <span aria-label={`${label} unavailable`} className="rounded-2xl border border-[var(--border)] px-3 py-3 text-center text-[var(--text-secondary)]">{label} unavailable</span>;
  }
  return <a href={href} target="_blank" rel="noreferrer" aria-label={label} className="rounded-2xl border border-[var(--border-strong)] px-3 py-3 text-center text-[var(--rare)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rare)]">{label}</a>;
}
```

- [ ] **Step 4: Implement the revealed reference layout**

In the revealed branch:

- make the artwork wrapper `relative`, give it `data-testid="planet-artwork"`, and render `<PlanetMiningOverlay mining={mining} miningAsOf={miningAsOf} />` after `<PlanetGif preview={preview} />`;
- place type and name below the artwork and remove the old standalone mineral line;
- render a ticket panel with Ticket ID, lifecycle badge, `TicketCoordinates`, and `TicketLifecycle`;
- add a visible `<h2>Details</h2>` followed by the six approved traits;
- replace Rings with `Base minerals`, using `mining?.baseMineralsPerDay ?? 'Unavailable'` and `data-trait="base-minerals"`;
- render `Ticket BaseScan` as `ticketTxHash ? `${EXPLORER_TX_URL}${ticketTxHash}` : undefined`;
- render `NFT BaseScan` only when both `tokenId` and `MEGAPLANETS_CONTRACT_ADDRESS` exist, using `${EXPLORER_NFT_URL}${MEGAPLANETS_CONTRACT_ADDRESS}/${tokenId}`;
- give both links `target="_blank"` and `rel="noreferrer"`.

Add a component test that omits both `ticketTxHash` and `tokenId`, then asserts `Ticket BaseScan unavailable` and `NFT BaseScan unavailable` are plain text with no corresponding links. This verifies missing provenance or deployment data cannot produce broken URLs.

Use only existing CSS variables such as `--surface`, `--surface-raised`, `--border`, `--border-strong`, `--text-primary`, `--text-secondary`, and `--rare`. Do not introduce a reference-specific palette.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
pnpm test -- src/components/planets/PlanetInventoryDetail.test.tsx
```

Expected: revealed layout, links, details, overlay placement, and claim-only state tests PASS.

- [ ] **Step 6: Review and checkpoint**

Run `git diff --check` and inspect both Task 3 files. Because these paths already contained working-tree changes before this stage, commit only if the complete staged diff is intentionally part of the approved My Planets work:

```powershell
git add -- src/components/planets/PlanetInventoryDetail.tsx src/components/planets/PlanetInventoryDetail.test.tsx
git commit -m "feat: rebuild expanded planet detail"
```

Otherwise leave them unstaged and record that the checkpoint commit was skipped to preserve user changes.

---

### Task 4: Ticket-only unrevealed detail

**Files:**
- Modify: `src/components/planets/PlanetInventoryDetail.tsx`
- Modify: `src/components/planets/PlanetInventoryDetail.test.tsx`

**Interfaces:**
- Consumes: the Task 3 `TicketLifecycle` and `TicketCoordinates` helpers.
- Produces: an unrevealed branch with only safe ticket provenance, state, link, and Mint action.

- [ ] **Step 1: Strengthen the unrevealed privacy test**

Render the unrevealed branch with its fixture `originTxHash` passed as `ticketTxHash`, plus `mining`, `miningAsOf`, a claimable status, and Mint action. Assert safe content:

```tsx
expect(screen.getByText('Ticket #24')).toBeInTheDocument();
expect(screen.getByText('4')).toBeInTheDocument();
expect(screen.getByText('66', { selector: '[data-coordinate="bonus"]' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Claim ($12.50)' })).toBeInTheDocument();
expect(screen.getByRole('link', { name: 'Ticket BaseScan' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Mint' })).toBeInTheDocument();
```

Assert private content is absent:

```tsx
expect(screen.queryByText('Kepler')).not.toBeInTheDocument();
expect(screen.queryByText('Gaia')).not.toBeInTheDocument();
expect(screen.queryByText('Epic')).not.toBeInTheDocument();
expect(screen.queryByText('Pixel continents')).not.toBeInTheDocument();
expect(screen.queryByTestId('planet-artwork')).not.toBeInTheDocument();
expect(screen.queryByTestId('planet-mining-overlay')).not.toBeInTheDocument();
expect(screen.queryByRole('link', { name: 'NFT BaseScan' })).not.toBeInTheDocument();
expect(screen.queryByText(/same type/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm test -- src/components/planets/PlanetInventoryDetail.test.tsx
```

Expected: FAIL because the old unrevealed silhouette remains and its Ticket BaseScan link is missing.

- [ ] **Step 3: Replace the unrevealed silhouette with the shared ticket panel**

Remove the `UnrevealedPlanetVisual` import from `PlanetInventoryDetail`. The unrevealed branch must render, in order:

1. optional Back control;
2. Ticket ID heading;
3. lifecycle badge and `TicketCoordinates`;
4. claim-only lifecycle control;
5. `Ticket BaseScan` purchase transaction link;
6. the existing Mint action.

Do not access `preview.descriptor.traits` or `preview.visual` anywhere in this branch. The only preview data read here is `preview.descriptor.input`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
pnpm test -- src/components/planets/PlanetInventoryDetail.test.tsx
```

Expected: all revealed and unrevealed tests PASS, including privacy assertions.

- [ ] **Step 5: Review and checkpoint**

Run `git diff --check`. If Task 3 was committed and the current staged diff contains only Task 4 work, commit:

```powershell
git add -- src/components/planets/PlanetInventoryDetail.tsx src/components/planets/PlanetInventoryDetail.test.tsx
git commit -m "feat: show ticket-only unrevealed detail"
```

If the files still contain pre-existing uncommitted work, leave them unstaged and report the skipped checkpoint.

---

### Task 5: Page wiring and integration behavior

**Files:**
- Modify: `src/pages/Planets.tsx:172-247`
- Modify: `src/pages/Planets.test.tsx:73-212`

**Interfaces:**
- Consumes: the Task 3 `PlanetInventoryDetail` prop contract.
- Produces: selected-ticket claim callback and real purchase/NFT explorer inputs without changing inventory selection or routes.

- [ ] **Step 1: Add failing page integration assertions**

Update the two test ticket hashes to valid 32-byte values:

```ts
originTxHash: `0x${'1'.repeat(64)}`
originTxHash: `0x${'2'.repeat(64)}`
```

In the selected revealed test, replace the old `View details` expectation with:

```tsx
expect(screen.getByRole('link', { name: 'Ticket BaseScan' })).toHaveAttribute(
  'href',
  `https://sepolia.basescan.org/tx/0x${'1'.repeat(64)}`,
);
expect(screen.getByRole('link', { name: 'NFT BaseScan' })).toHaveAttribute(
  'href',
  expect.stringMatching(/\/7$/),
);
```

Add a test proving a drawn selected ticket does not navigate or claim:

```tsx
it('renders a non-interactive drawn lifecycle state', () => {
  const onNavigate = vi.fn();
  render(<Planets onNavigate={onNavigate} onViewPlanet={vi.fn()} />);
  screen.getByRole('button', { name: 'Select Astra' }).click();
  const detail = screen.getByRole('complementary', { name: 'Selected planet detail' });
  expect(within(detail).getByText('Drawn')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Drawn' })).not.toBeInTheDocument();
  expect(state.claim).not.toHaveBeenCalled();
  expect(onNavigate).not.toHaveBeenCalled();
});
```

Extend the unrevealed selection test to expect its `Ticket BaseScan` link and no `NFT BaseScan` link within the selected-detail aside.

- [ ] **Step 2: Run the page test and verify RED**

Run:

```powershell
pnpm test -- src/pages/Planets.test.tsx
```

Expected: FAIL because `Planets` still passes the old action/view-details props and drawn state remains wired to History.

- [ ] **Step 3: Narrow page behavior to the real claim path**

Resolve the selected ticket provenance next to `selectedStatus`:

```ts
const selectedTicket = selected
  ? tickets.find((ticket) => ticket.ticketId.toString() === selected.ticketId)
  : undefined;
```

Replace `runSelectedStatusAction` with:

```ts
const claimSelectedTicket = () => {
  if (selectedStatus.kind !== 'claim') return;
  void claim.claim([selectedStatus.ticketId]);
};
```

Update `PlanetInventoryDetail` usage:

```tsx
<PlanetInventoryDetail
  preview={selected.preview}
  tokenId={selected.tokenId}
  ticketTxHash={selectedTicket?.originTxHash}
  revealed={selected.revealed}
  ticketStatus={selectedStatus}
  mintAction={mintAction(selected.preview)}
  onClaim={claimSelectedTicket}
  statusPending={claim.isPending}
  onBack={routePlanetId ? () => onNavigate('planets') : mobileDetailTicketId ? () => setMobileDetailTicketId(null) : undefined}
  mining={selectedMining}
  miningAsOf={mining.data?.asOf}
/>
```

Remove `onViewDetails` only from the detail component call. Keep card selection and `onViewPlanet` routing unchanged so mobile revealed cards and direct `/planet/:id` still work.

- [ ] **Step 4: Run focused integration tests and verify GREEN**

Run:

```powershell
pnpm test -- src/pages/Planets.test.tsx src/components/planets/PlanetInventoryDetail.test.tsx
```

Expected: PASS with real ticket ID claims, non-interactive terminal states, links, selection, mobile routing, and privacy coverage.

- [ ] **Step 5: Review and checkpoint**

Run `git diff --check` and inspect the complete page/test diff. Commit only if all staged changes belong to the approved My Planets stage:

```powershell
git add -- src/pages/Planets.tsx src/pages/Planets.test.tsx
git commit -m "feat: wire expanded planet ticket state"
```

Otherwise leave these already-dirty files unstaged and report the skipped checkpoint.

---

### Task 6: Full verification and visual QA

**Files:**
- Verify only.

**Interfaces:**
- Consumes: completed Tasks 1-5.
- Produces: evidence for static checks, tests, production build, and observable responsive behavior.

- [ ] **Step 1: Run required repository verification**

Run each command separately:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: every command exits 0. Record exact test counts and any non-failing warnings.

- [ ] **Step 2: Start the existing local development server**

Use the repository's configured pnpm dev command and an available localhost port. Do not claim production or live RPC validation from this server.

- [ ] **Step 3: Inspect desktop My Planets**

At a desktop viewport, verify:

- the selected detail remains sticky beside the collection;
- the mining panel overlays the lower artwork and does not cover identity text;
- all three metrics remain inside the artwork bounds;
- Details is fully visible with no chevron or collapse control;
- Claim is the only interactive lifecycle state;
- Ticket and NFT explorer links are visually distinct and keyboard focusable.

- [ ] **Step 4: Inspect mobile and direct planet routes**

At a mobile viewport, verify:

- tapping a revealed card still opens the full-page planet route;
- the overlay fits without horizontal scrolling;
- ticket coordinates wrap cleanly;
- an unrevealed selection shows only ticket data, lifecycle, Ticket BaseScan, and Mint;
- Back returns to My Planets.

- [ ] **Step 5: Perform the final privacy and scope audit**

Run:

```powershell
git status --short
git diff --check
git diff -- src/components/planets/PlanetInventoryDetail.tsx src/components/planets/PlanetMiningOverlay.tsx src/pages/Planets.tsx src/config/contracts.ts
```

Confirm no purchase, approval, voucher, mint, indexer, generator, mining calculation, contract, secret, or unrelated behavior changed. Report browser checks separately from automated checks and explicitly note any wallet/RPC flow not exercised live.
