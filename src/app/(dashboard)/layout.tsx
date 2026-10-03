import { redirect } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardNavbar } from "@/modules/dashboard/ui/components/dashboard-navbar";
import { DashboardSidebar } from "@/modules/dashboard/ui/components/dashboard-sidebar";
import { createTRPCContext } from "@/trpc/init";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Same cached lookup the tRPC context uses for this request.
  const { session } = await createTRPCContext();

  if (!session) {
    redirect("/sign-in");
  }

  const { name, email, image } = session.user;

  return (
    <SidebarProvider>
      <DashboardSidebar user={{ name, email, image: image ?? null }} />
      <SidebarInset className="min-h-svh bg-muted">
        <DashboardNavbar />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
