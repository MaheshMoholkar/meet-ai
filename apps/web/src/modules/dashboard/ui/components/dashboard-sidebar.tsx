"use client";

import { BotIcon, VideoIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoLockup } from "@/components/icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { DashboardSearchButton } from "./dashboard-search";
import { DashboardUserButton, type DashboardUser } from "./dashboard-user-button";

const navItems = [
  { icon: VideoIcon, label: "Meetings", href: "/meetings" },
  { icon: BotIcon, label: "Agents", href: "/agents" },
] as const;

/** The app's one piece of navigation: the mark, search, Meetings, Agents, and you. */
export function DashboardSidebar({ user }: { user: DashboardUser }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="gap-4 p-3">
        <Link href="/meetings" className="focus-ring w-fit rounded-md px-1 pt-1">
          <LogoLockup />
        </Link>
        <DashboardSearchButton />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3 py-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map(({ icon: Icon, label, href }) => (
                <SidebarMenuItem key={href}>
                  {/* The current item is ink on a quiet fill. Blue is the agent's, not the navigation's. */}
                  <SidebarMenuButton asChild isActive={pathname.startsWith(href)}>
                    <Link href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <DashboardUserButton user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
