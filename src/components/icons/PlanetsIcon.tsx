import type { SVGProps } from 'react';

export function PlanetsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 3h8v2h3v3h2v8h-2v3h-3v2H8v-2H5v-3H3V8h2V5h3V3Zm0 4H6v3H5v4h1v3h3v2h6v-2h3v-3h1v-4h-1V7h-3V5H9v2Zm2 2h4v2h2v3h-2v2h-4v-2H8v-3h2V9Z" />
    </svg>
  );
}
