"use client";

import { SearchIcon } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { Kbd } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";

import { DashboardCommand } from "./dashboard-command";

const SearchContext = createContext<{ openSearch: () => void } | null>(null);

/**
 * Owns the command palette for the whole dashboard, so it outlives the mobile
 * sidebar sheet that holds its button. Opens on ⌘K / Ctrl+K from anywhere.
 */
export function DashboardSearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(() => ({ openSearch: () => setOpen(true) }), []);

  return (
    <SearchContext.Provider value={value}>
      <DashboardCommand open={open} onOpenChange={setOpen} />
      {children}
    </SearchContext.Provider>
  );
}

/** The sidebar's search button: looks like an input, opens the command palette. */
export function DashboardSearchButton() {
  const search = useContext(SearchContext);
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <button
      type="button"
      onClick={() => {
        // On mobile the sidebar is a sheet; close it so the palette isn't stacked on top.
        if (isMobile) setOpenMobile(false);
        search?.openSearch();
      }}
      className="focus-ring flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-background pr-1.5 pl-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-input"
    >
      <SearchIcon className="size-4 shrink-0" />
      <span className="flex-1">Search</span>
      <Kbd>⌘K</Kbd>
    </button>
  );
}
