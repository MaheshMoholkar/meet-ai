"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useState } from "react";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Highlight } from "@/components/highlight";
import { Input } from "@/components/ui/input";
import { formatTimestamp } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

interface Props {
  meetingId: string;
  /** When there is a recording, a timestamp plays it from that moment. */
  onSeek?: (ms: number) => void;
}

/** Everything that was said, typed the way a transcript is typed: time, speaker, words. */
export function Transcript({ meetingId, onSeek }: Props) {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(trpc.meetings.getTranscript.queryOptions({ id: meetingId }));
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const items = (data?.items ?? []).filter((item) => item.text.toLowerCase().includes(needle));

  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="relative w-fit">
        <Input
          placeholder="Search transcript"
          aria-label="Search transcript"
          className="w-60 pl-[34px]"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {isPending && <p className="text-[13px] leading-[18px] text-muted-foreground">Loading transcript…</p>}
      {data && items.length === 0 && (
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {data.items.length === 0 ? "Nothing was said in this call." : "No lines match your search."}
        </p>
      )}
      <ol className="-mx-2 flex flex-col">
        {data &&
          items.map((item) => {
            const isAgent = item.speaker === "agent";
            const name = data.names[item.speaker];
            const time = formatTimestamp(item.startMs);
            return (
              <li
                key={`${item.speaker}-${item.startMs}`}
                className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-md px-2 py-2.5 hover:bg-muted sm:grid-cols-[56px_168px_minmax(0,1fr)]"
              >
                {onSeek ? (
                  <button
                    type="button"
                    onClick={() => onSeek(item.startMs)}
                    aria-label={`Play from ${time}`}
                    className="focus-ring timecode mt-1 w-fit rounded-sm text-left text-muted-foreground hover:text-foreground"
                  >
                    {time}
                  </button>
                ) : (
                  <span className="timecode mt-1 text-muted-foreground">{time}</span>
                )}
                <div className="flex min-w-0 items-center gap-x-2 pt-px">
                  <GeneratedAvatar
                    seed={name}
                    variant={isAgent ? "botttsNeutral" : "initials"}
                    imageUrl={isAgent ? null : data.userImage}
                    className="size-6"
                  />
                  <p className="truncate text-sm font-semibold">{name}</p>
                </div>
                <p className="col-span-2 max-w-[68ch] text-base leading-[26px] sm:col-span-1">
                  <Highlight text={item.text} query={query} />
                </p>
              </li>
            );
          })}
      </ol>
    </div>
  );
}
