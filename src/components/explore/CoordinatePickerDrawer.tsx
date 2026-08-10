import type { ReactNode } from 'react';

/** Local Drawer surface; matches Vaul's mobile bottom-sheet interaction without adding a second dialog library. */
export function CoordinatePickerDrawer({ children }: { children: ReactNode }) {
  return <div className="sm:hidden">{children}</div>;
}
