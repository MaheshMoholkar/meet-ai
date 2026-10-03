"use client";

import {
  BookOpenTextIcon,
  CircleXIcon,
  ClockArrowUpIcon,
  FileTextIcon,
  LoaderIcon,
  RadioIcon,
  VideoIcon,
} from "lucide-react";

import { EmptyState } from "@/components/state-views";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { MeetingGetOne } from "../../types";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-6 rounded-lg bg-background px-4 py-5">
      {children}
    </div>
  );
}

/** Joining is wired up in sub-project 2 (call stack). */
function JoinButton({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Disabled buttons don't fire pointer events; the wrapper keeps the tooltip working. */}
        <span tabIndex={0} className="w-full lg:w-auto">
          <Button disabled className="w-full lg:w-auto">
            <VideoIcon />
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Calls arrive in the next release</TooltipContent>
    </Tooltip>
  );
}

export function UpcomingState() {
  return (
    <Panel>
      <EmptyState
        icon={ClockArrowUpIcon}
        title="Not started yet"
        description="Once you start this meeting, a summary will appear here."
      />
      <JoinButton label="Start meeting" />
    </Panel>
  );
}

export function ActiveState() {
  return (
    <Panel>
      <EmptyState
        icon={RadioIcon}
        title="Meeting is active"
        description="The meeting ends once you leave the call."
      />
      <JoinButton label="Join meeting" />
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

export function CompletedState({ data }: { data: MeetingGetOne }) {
  return (
    <Panel>
      <EmptyState
        icon={data.summary ? BookOpenTextIcon : FileTextIcon}
        title="Meeting completed"
        description="Summary, transcript, recording and Ask AI arrive with the post-call pipeline."
      />
    </Panel>
  );
}
