import { redirect } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardNavbar } from "@/modules/dashboard/ui/components/dashboard-navbar";
import { DashboardSearchProvider } from "@/modules/dashboard/ui/components/dashboard-search";
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
    // `open` keeps the sidebar in place on desktop; on mobile it is a sheet with its own state.
    <SidebarProvider open>
      <DashboardSearchProvider>
        <DashboardSidebar user={{ name, email, image: image ?? null }} />
        <SidebarInset className="min-h-svh">
          <DashboardNavbar />
          {/* The canvas: one left-aligned column, no cards on a grey ground. */}
          <div className="mx-auto flex w-full max-w-[1104px] flex-1 flex-col px-4 pt-6 pb-12 md:px-8 md:pt-8">
            {children}
          </div>
        </SidebarInset>
      </DashboardSearchProvider>
    </SidebarProvider>
  );
}
