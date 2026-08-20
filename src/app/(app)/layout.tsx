import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SessionProvider } from "@/components/providers/session-provider";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <ImpersonationBanner />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
