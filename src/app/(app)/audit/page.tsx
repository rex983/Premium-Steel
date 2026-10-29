import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/layout/app-header";
import { AuditLogView, canSeeAuditLog, type AuditSearchParams } from "@/lib/launcher-kit/audit-log";

export const dynamic = "force-dynamic";

// This app's edit history (the shared audit_log).
export default async function EditHistoryPage({ searchParams }: { searchParams: Promise<AuditSearchParams> }) {
  const session = await auth();
  if (!canSeeAuditLog(session?.user?.permRole)) redirect("/calculator");

  return (
    <>
      <AppHeader title="Edit history" />
      <main className="flex-1 p-6">
        <AuditLogView searchParams={await searchParams} />
      </main>
    </>
  );
}
