import type { SVGProps } from 'react';

export function PlanetsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="5" />
      <path d="M3.4 10.2c-1.2 1.1-.7 2.4 1.3 3.5 3.5 1.9 10 2.3 14.5.8 2.5-.8 3.2-2 1.7-3.2" />
    </svg>
  );
}
