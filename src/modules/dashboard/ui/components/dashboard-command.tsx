"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CommandResponsiveDialog } from "@/components/command-responsive-dialog";
import { GeneratedAvatar } from "@/components/generated-avatar";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useTRPC } from "@/trpc/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
        <CommandGroup heading="Meetings">
          <CommandEmpty>
            <span className="text-sm text-muted-foreground">No meetings found</span>
          </CommandEmpty>
          {meetings.data?.items.map((meeting) => (
            <CommandItem key={meeting.id} value={meeting.id} onSelect={() => go(`/meetings/${meeting.id}`)}>
              {meeting.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Agents">
          {agents.data?.items.map((agent) => (
            <CommandItem key={agent.id} value={agent.id} onSelect={() => go(`/agents/${agent.id}`)}>
              <GeneratedAvatar seed={agent.name} variant="botttsNeutral" className="size-5" />
              {agent.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandResponsiveDialog>
  );
}
