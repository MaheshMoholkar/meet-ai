"use client";

import { Command, CommandDialog } from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Let a parent filter (for example via a server search) instead of cmdk's built-in filter. */
  shouldFilter?: boolean;
  children: React.ReactNode;
}

/** A command palette: dialog on desktop, drawer on mobile. */
export function CommandResponsiveDialog({
  open,
  onOpenChange,
  title = "Search",
  shouldFilter = true,
  children,
}: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <Command shouldFilter={shouldFilter}>{children}</Command>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={title}>
      <Command shouldFilter={shouldFilter}>{children}</Command>
    </CommandDialog>
  );
}
