// app/rider/layout.tsx
// Passthrough layout for all /rider/* routes.

import type { ReactNode } from 'react';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export default function RiderLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ServiceWorkerRegister role="rider" />
    </>
  );
}
