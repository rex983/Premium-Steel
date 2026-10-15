import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SessionProvider } from "@/components/providers/session-provider";
import { ViewAsBanner } from "@/lib/launcher-kit/view-as-banner";
import { Tracker } from "@/lib/launcher-kit/tracker";
import { auth } from "@/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const viewAs = session?.viewAs;
  return (
    <SessionProvider>
      <Tracker />
      <SidebarProvider>
        <AppSidebar />
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
