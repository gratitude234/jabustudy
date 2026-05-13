// app/admin/study/semester-health/page.tsx
import "server-only";

import { requireAdmin } from "@/lib/admin/requireAdmin";
import SemesterHealthClient from "./SemesterHealthClient";

export default async function SemesterHealthPage() {
  await requireAdmin();
  return <SemesterHealthClient />;
}
