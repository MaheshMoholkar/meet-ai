"use client";

import { BotIcon, VideoIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/icons";
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
  SidebarSeparator,
} from "@/components/ui/sidebar";

import { DashboardUserButton, type DashboardUser } from "./dashboard-user-button";

const navItems = [
  { icon: VideoIcon, label: "Meetings", href: "/meetings" },
  { icon: BotIcon, label: "Agents", href: "/agents" },
] as const;

export function DashboardSidebar({ user }: { user: DashboardUser }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/meetings" className="flex items-center gap-2 px-2 pt-2">
          <Logo className="size-8 text-sidebar-primary" />
          <span className="text-xl font-semibold">Meet AI</span>
        </Link>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ icon: Icon, label, href }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(href)} className="h-10">
                    <Link href={href}>
                      <Icon />
                      <span className="font-medium tracking-tight">{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DashboardUserButton user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
