"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { DashboardCommand } from "./dashboard-command";

export function DashboardNavbar() {
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <DashboardCommand open={commandOpen} onOpenChange={setCommandOpen} />
      <nav className="flex items-center gap-x-2 border-b bg-background px-4 py-3">
        <SidebarTrigger className="size-9" variant="outline" />
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-60 justify-start font-normal text-muted-foreground hover:text-muted-foreground"
          onClick={() => setCommandOpen(true)}
        >
          <SearchIcon />
          Search
          <kbd className="pointer-events-none ml-auto inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </nav>
    </>
  );
}
