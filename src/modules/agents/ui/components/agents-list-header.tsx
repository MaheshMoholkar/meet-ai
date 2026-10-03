"use client";

import { PlusIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";

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
      <div className="flex flex-col gap-y-4 px-4 py-4 md:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium">My agents</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon />
            New agent
          </Button>
        </div>
        <ScrollArea>
          <div className="flex items-center gap-x-2 p-1">
            <SearchFilter
              value={filters.search}
              onChange={(search) => setFilters({ search, page: DEFAULT_PAGE })}
              placeholder="Filter by name"
            />
            {filters.search && (
              <Button variant="outline" size="sm" onClick={() => setFilters({ search: "", page: DEFAULT_PAGE })}>
                <XCircleIcon />
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
