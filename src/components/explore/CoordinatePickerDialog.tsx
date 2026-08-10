import type { ReactNode } from 'react';

export function CoordinatePickerDialog({ children }: { children: ReactNode }) {
  return <div className="hidden sm:block">{children}</div>;
}
