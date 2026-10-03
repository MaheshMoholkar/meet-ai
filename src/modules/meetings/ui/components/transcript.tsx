"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useState } from "react";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Highlight } from "@/components/highlight";
import { Input } from "@/components/ui/input";
import { formatTimestamp } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

export function Transcript({ meetingId }: { meetingId: string }) {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(trpc.meetings.getTranscript.queryOptions({ id: meetingId }));
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const items = (data?.items ?? []).filter((item) => item.text.toLowerCase().includes(needle));

  return (
    <div className="flex w-full flex-col gap-y-4 rounded-lg border bg-background px-4 py-5">
      <p className="text-sm font-medium">Transcript</p>
      <div className="relative">
        <Input
          placeholder="Search transcript"
          aria-label="Search transcript"
          className="h-9 w-60 pl-7"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SearchIcon className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {isPending && <p className="text-sm text-muted-foreground">Loading transcript…</p>}
      {data && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {data.items.length === 0 ? "Nothing was said in this call." : "No lines match your search."}
        </p>
      )}
      <ol className="flex flex-col gap-y-3">
        {data &&
          items.map((item) => {
            const isAgent = item.speaker === "agent";
            const name = data.names[item.speaker];
            return (
              <li key={`${item.speaker}-${item.startMs}`} className="flex flex-col gap-y-2 rounded-md border p-4 hover:bg-muted">
                <div className="flex items-center gap-x-2">
                  <GeneratedAvatar
                    seed={name}
                    variant={isAgent ? "botttsNeutral" : "initials"}
                    imageUrl={isAgent ? null : data.userImage}
                    className="size-6"
                  />
                  <p className="text-sm font-medium capitalize">{name}</p>
                  <p className="text-sm font-medium text-blue-600">{formatTimestamp(item.startMs)}</p>
                </div>
                <p className="text-sm text-neutral-700">
                  <Highlight text={item.text} query={query} />
                </p>
              </li>
            );
          })}
      </ol>
    </div>
  );
}
