import Link from "next/link";

import { LogoLockup } from "@/components/icons";
import { SidebarTrigger } from "@/components/ui/sidebar";

/** Mobile only: on desktop the sidebar is always there and carries search. */
export function DashboardNavbar() {
  return (
    <nav aria-label="Menu" className="flex h-12 items-center gap-2 border-b px-3 md:hidden">
      <SidebarTrigger />
      <Link href="/meetings" className="focus-ring rounded-md">
        <LogoLockup />
      </Link>
    </nav>
  );
}
