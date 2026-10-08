"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { SearchFilter } from "@/components/search-filter";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DEFAULT_PAGE } from "@/constants";

import { useAgentsFilters } from "../../hooks/use-agents-filters";
import { NewAgentDialog } from "./agent-dialogs";

export function AgentsListHeader() {
  const [filters, setFilters] = useAgentsFilters();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <NewAgentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <div className="flex flex-col gap-y-6 pb-5">
        <PageHeader
          title="My agents"
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <PlusIcon />
              New agent
            </Button>
          }
        />
        <ScrollArea>
          {/* The padding keeps focus outlines from being clipped by the scroll area. */}
          <div className="flex items-center gap-x-2 p-1">
            <SearchFilter
              value={filters.search}
              onChange={(search) => setFilters({ search, page: DEFAULT_PAGE })}
              placeholder="Filter by name"
            />
            {filters.search && (
              <Button variant="ghost" onClick={() => setFilters({ search: "", page: DEFAULT_PAGE })}>
                <XIcon />
                Clear
              </Button>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </>
  );
}
