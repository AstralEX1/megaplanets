/**
 * ---
 * @customize  The kit's logo mark. Generic emerald-on-emerald "M" rounded
 *             square — chosen as an obviously placeholder shape so a fork
 *             has a single, unmistakable swap point for branding.
 *
 *             To rebrand: replace the <svg> body below with your own mark.
 *             The default scale is 24×24 inside a 32×32 viewBox; pass a
 *             custom `className` to override size or override fill colors
 *             by editing them inline. The header layout reserves a square
 *             slot at the start of the brand block.
 *
 *             That's the entire branding swap for the mark.
 * ---
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={`shrink-0 ${className ?? ''}`.trim()}
    >
      <rect x="8" y="2" width="16" height="4" fill="#f4f7ff" />
      <rect x="4" y="6" width="24" height="20" fill="#f4f7ff" />
      <rect x="8" y="26" width="16" height="4" fill="#f4f7ff" />
      <rect x="8" y="6" width="16" height="20" fill="#536bff" />
      <rect x="4" y="10" width="4" height="12" fill="#8396ff" />
      <rect x="24" y="10" width="4" height="12" fill="#263a9f" />
      <rect x="12" y="6" width="8" height="4" fill="#a8b4ff" />
      <rect x="8" y="10" width="8" height="8" fill="#7488ff" />
      <rect x="16" y="18" width="8" height="8" fill="#3546ba" />
      <rect x="12" y="22" width="4" height="4" fill="#dbe1ff" />
    </svg>
  );
}
