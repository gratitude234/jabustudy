// app/vendor/layout.tsx
// Passthrough layout for all /vendor/* routes.
// Auth is handled client-side in each individual page (create, register, dashboard).
// A server-side redirect here breaks navigation when the server session cookie
// hasn't been written yet (common on first load), even though the user IS logged in.

import type { ReactNode } from 'react';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export default function VendorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ServiceWorkerRegister role="vendor" />
    </>
  );
}
