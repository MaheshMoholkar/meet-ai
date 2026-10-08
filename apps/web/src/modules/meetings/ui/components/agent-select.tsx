"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { CommandSelect } from "@/components/command-select";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { MAX_PAGE_SIZE } from "@/constants";
import { useTRPC } from "@/trpc/client";

interface Props {
  value: string;
  onSelect: (agentId: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
}

/** Searchable picker over the user's agents (server-side search). */
export function AgentSelect({ placeholder = "Select an agent", ...props }: Props) {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const { data } = useQuery(trpc.agents.getMany.queryOptions({ search, pageSize: MAX_PAGE_SIZE }));

  return (
    <CommandSelect
      {...props}
      placeholder={placeholder}
      onSearch={setSearch}
      options={(data?.items ?? []).map((agent) => ({
        id: agent.id,
        value: agent.id,
        label: agent.name,
        children: (
          <div className="flex min-w-0 items-center gap-x-2">
            <GeneratedAvatar seed={agent.name} variant="botttsNeutral" className="size-5" />
            <span className="truncate">{agent.name}</span>
          </div>
        ),
      }))}
    />
  );
}
