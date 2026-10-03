"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";

export function Recording({ meetingId, hasRecording }: { meetingId: string; hasRecording: boolean }) {
  const trpc = useTRPC();
  // The link is valid for 15 minutes; refresh it before it expires.
  const { data: url, isPending } = useQuery({
    ...trpc.meetings.getRecordingUrl.queryOptions({ id: meetingId }),
    enabled: hasRecording,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  return (
    <div className="flex flex-col gap-y-4 rounded-lg border bg-background px-4 py-5">
      <p className="text-sm font-medium">Recording</p>
      {!hasRecording && (
        <p className="text-sm text-muted-foreground">
          There&apos;s no recording for this meeting. It may still be uploading; check back in a minute.
        </p>
      )}
      {hasRecording && isPending && <p className="text-sm text-muted-foreground">Loading recording…</p>}
      {url && <audio src={url} controls className="w-full" preload="metadata" />}
    </div>
  );
}
