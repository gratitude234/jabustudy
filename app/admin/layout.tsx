// app/admin/layout.tsx

import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin/requireAdmin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    if (status === 401) {
      redirect(`/login?next=${encodeURIComponent("/admin")}`);
    }
    // Forbidden or other errors
    redirect("/study");
  }

  return <AdminShell>{children}</AdminShell>;
}
