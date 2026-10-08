"use client";

import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { authClient } from "@/lib/auth-client";

export interface DashboardUser {
  name: string;
  email: string;
  image: string | null;
}

function UserSummary({ user }: { user: DashboardUser }) {
  return (
    <>
      <GeneratedAvatar seed={user.name} variant="initials" imageUrl={user.image} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden text-left">
        <p className="w-full truncate text-sm leading-[18px] font-semibold">{user.name}</p>
        <p className="w-full truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
    </>
  );
}

const triggerClassName =
  "focus-ring flex w-full items-center justify-between gap-x-2.5 overflow-hidden rounded-md p-2 transition-colors hover:bg-sidebar-accent";

export function DashboardUserButton({ user }: { user: DashboardUser }) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const onSignOut = () =>
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
          router.refresh();
        },
      },
    });

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger className={triggerClassName}>
          <UserSummary user={user} />
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{user.name}</DrawerTitle>
            <DrawerDescription>{user.email}</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button variant="outline" onClick={onSignOut}>
              <LogOutIcon /> Sign out
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName}>
        <UserSummary user={user} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="truncate text-[13px] leading-[18px] text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="cursor-pointer">
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
