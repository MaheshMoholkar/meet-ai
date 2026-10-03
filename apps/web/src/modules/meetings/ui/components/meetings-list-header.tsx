"use client";

import { PlusIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";

import { CommandSelect } from "@/components/command-select";
import { SearchFilter } from "@/components/search-filter";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DEFAULT_PAGE } from "@/constants";
import { cn } from "@/lib/utils";

import { useMeetingsFilters } from "../../hooks/use-meetings-filters";
import { MEETING_STATUSES, type MeetingStatus } from "../../schemas";
import { statusMeta } from "../status";
import { AgentSelect } from "./agent-select";
import { NewMeetingDialog } from "./meeting-dialogs";

const statusOptions = MEETING_STATUSES.map((status) => {
  const { label, icon: Icon, spin } = statusMeta[status];
  return {
    id: status,
    value: status,
    label,
    children: (
      <div className="flex items-center gap-x-2">
        <Icon className={cn("size-4", spin && "animate-spin")} />
        {label}
      </div>
    ),
  };
});

export function MeetingsListHeader() {
  const [filters, setFilters] = useMeetingsFilters();
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasFilters = Boolean(filters.search || filters.status || filters.agentId);

  return (
    <>
      <NewMeetingDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <div className="flex flex-col gap-y-4 px-4 py-4 md:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium">My meetings</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon />
            New meeting
          </Button>
        </div>
        <ScrollArea>
          <div className="flex items-center gap-x-2 p-1">
            <SearchFilter
              value={filters.search}
              onChange={(search) => setFilters({ search, page: DEFAULT_PAGE })}
              placeholder="Filter by name"
            />
            <CommandSelect
              className="h-9 w-40 bg-background"
              placeholder="Status"
              options={statusOptions}
              value={filters.status ?? ""}
              onSelect={(status) => setFilters({ status: status as MeetingStatus, page: DEFAULT_PAGE })}
            />
            <AgentSelect
              className="h-9 w-48 bg-background"
              placeholder="Agent"
              value={filters.agentId ?? ""}
              onSelect={(agentId) => setFilters({ agentId, page: DEFAULT_PAGE })}
            />
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setFilters({ search: "", status: null, agentId: null, page: DEFAULT_PAGE })}
              >
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
