"use client";

import { CircleXIcon, ClockArrowUpIcon, LoaderIcon, RadioIcon, VideoIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/state-views";
import { Button } from "@/components/ui/button";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-6 rounded-lg bg-background px-4 py-5">
      {children}
    </div>
  );
}

function JoinButton({ meetingId, label }: { meetingId: string; label: string }) {
  return (
    <Button asChild className="w-full lg:w-auto">
      <Link href={`/call/${meetingId}`}>
        <VideoIcon />
        {label}
      </Link>
    </Button>
  );
}

export function UpcomingState({ meetingId }: { meetingId: string }) {
  return (
    <Panel>
      <EmptyState
        icon={ClockArrowUpIcon}
        title="Not started yet"
        description="Once you start this meeting, a summary will appear here."
      />
      <JoinButton meetingId={meetingId} label="Start meeting" />
    </Panel>
  );
}

export function ActiveState({ meetingId }: { meetingId: string }) {
  return (
    <Panel>
      <EmptyState
        icon={RadioIcon}
        title="Meeting is active"
        description="The meeting ends once you leave the call."
      />
      <JoinButton meetingId={meetingId} label="Join meeting" />
    </Panel>
  );
}

export function ProcessingState() {
  return (
    <Panel>
      <EmptyState
        icon={LoaderIcon}
        title="Meeting completed"
        description="The summary is being generated. This usually takes a minute or two."
      />
    </Panel>
  );
}

export function FailedState() {
  return (
    <Panel>
      <EmptyState
        icon={CircleXIcon}
        title="Summary couldn't be generated"
        description="The call ended, but processing it failed. The transcript and summary aren't available for this meeting."
      />
    </Panel>
  );
}
