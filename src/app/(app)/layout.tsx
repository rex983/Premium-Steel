import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SessionProvider } from "@/components/providers/session-provider";
import { ViewAsBanner } from "@/lib/launcher-kit/view-as-banner";
import { UsageBeacon } from "@/lib/launcher-kit/usage-beacon";
import { canSeeAuditLog } from "@/lib/launcher-kit/audit-log";
import { auth } from "@/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const viewAs = session?.viewAs;
  return (
    <SessionProvider>
      <UsageBeacon />
      <SidebarProvider>
        <AppSidebar showAuditLog={canSeeAuditLog(session?.user?.permRole)} />
        <SidebarInset>
          {viewAs && (
            <ViewAsBanner
              viewedName={session.user?.name?.trim() || session.user?.email || "user"}
              viewedRole={session.user?.role}
              actorName={viewAs.actorName?.trim() || viewAs.actorEmail}
            />
          )}
          {children}
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
