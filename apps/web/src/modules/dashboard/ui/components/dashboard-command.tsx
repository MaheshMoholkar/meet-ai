"use client";

import { useQuery } from "@tanstack/react-query";
import { VideoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CommandResponsiveDialog } from "@/components/command-responsive-dialog";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { Highlight } from "@/components/highlight";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { formatShortDate } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Find a meeting or an agent from anywhere. */
export function DashboardCommand({ open, onOpenChange }: Props) {
  const router = useRouter();
  const trpc = useTRPC();
  const [search, setSearch] = useState("");

  const meetings = useQuery({
    ...trpc.meetings.getMany.queryOptions({ search, pageSize: 5 }),
    enabled: open,
  });
  const agents = useQuery({
    ...trpc.agents.getMany.queryOptions({ search, pageSize: 5 }),
    enabled: open,
  });

  const meetingItems = meetings.data?.items ?? [];
  const agentItems = agents.data?.items ?? [];
  const loaded = !meetings.isPending && !agents.isPending;

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Find a meeting or agent"
      shouldFilter={false}
    >
      <CommandInput placeholder="Find a meeting or agent..." value={search} onValueChange={setSearch} />
      <CommandList>
        {loaded && <CommandEmpty>No meetings or agents found</CommandEmpty>}
        {meetingItems.length > 0 && (
          <CommandGroup heading="Meetings">
            {meetingItems.map((meeting) => (
              <CommandItem key={meeting.id} value={meeting.id} onSelect={() => go(`/meetings/${meeting.id}`)}>
                <VideoIcon className="text-muted-foreground" />
                <span className="truncate">
                  <Highlight text={meeting.name} query={search} />
                </span>
                {meeting.startedAt && <CommandShortcut>{formatShortDate(meeting.startedAt)}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {agentItems.length > 0 && (
          <CommandGroup heading="Agents">
            {agentItems.map((agent) => (
              <CommandItem key={agent.id} value={agent.id} onSelect={() => go(`/agents/${agent.id}`)}>
                <GeneratedAvatar seed={agent.name} variant="botttsNeutral" className="size-5" />
                <span className="truncate">
                  <Highlight text={agent.name} query={search} />
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <div className="hidden items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground md:flex">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          to move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd>
          to open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          to close
        </span>
      </div>
    </CommandResponsiveDialog>
  );
}
