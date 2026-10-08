"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { CommandSelect } from "@/components/command-select";
import { PageHeader } from "@/components/page-header";
import { SearchFilter } from "@/components/search-filter";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DEFAULT_PAGE } from "@/constants";

import { useMeetingsFilters } from "../../hooks/use-meetings-filters";
import { MEETING_STATUSES, type MeetingStatus } from "../../schemas";
import { statusMeta } from "../status";
import { AgentSelect } from "./agent-select";
import { NewMeetingDialog } from "./meeting-dialogs";
import { StatusIcon } from "./status-badge";

const statusOptions = MEETING_STATUSES.map((status) => {
  const { label } = statusMeta[status];
  return {
    id: status,
    value: status,
    label,
    children: (
      <div className="flex items-center gap-x-2">
        <StatusIcon status={status} className="size-4 text-muted-foreground" />
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
      <div className="flex flex-col gap-y-6 pb-5">
        <PageHeader
          title="My meetings"
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <PlusIcon />
              New meeting
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
            <CommandSelect
              className="w-40"
              placeholder="Status"
              options={statusOptions}
              value={filters.status ?? ""}
              onSelect={(status) => setFilters({ status: status as MeetingStatus, page: DEFAULT_PAGE })}
            />
            <AgentSelect
              className="w-48"
              placeholder="Agent"
              value={filters.agentId ?? ""}
              onSelect={(agentId) => setFilters({ agentId, page: DEFAULT_PAGE })}
            />
            {hasFilters && (
              <Button
                variant="ghost"
                onClick={() => setFilters({ search: "", status: null, agentId: null, page: DEFAULT_PAGE })}
              >
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
