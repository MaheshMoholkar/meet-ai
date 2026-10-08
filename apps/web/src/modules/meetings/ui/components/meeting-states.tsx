import { CircleXIcon, ClockArrowUpIcon, LoaderIcon, RadioIcon } from "lucide-react";

import { EmptyState } from "@/components/state-views";

// What a meeting page shows before there is a summary. The Start / Join button
// lives in the page header, so these never repeat it.

export function UpcomingState() {
  return (
    <EmptyState
      icon={ClockArrowUpIcon}
      title="Not started yet"
      description="Once you start this meeting, a summary will appear here."
    />
  );
}

export function ActiveState() {
  return (
    <EmptyState
      icon={RadioIcon}
      title="Meeting is active"
      description="The meeting ends once you leave the call."
    />
  );
}

export function ProcessingState() {
  return (
    <EmptyState
      icon={LoaderIcon}
      title="Meeting completed"
      description="The summary is being generated. This usually takes a minute or two."
    />
  );
}

export function FailedState() {
  return (
    <EmptyState
      icon={CircleXIcon}
      title="Summary couldn't be generated"
      description="The call ended, but processing it failed. The transcript and summary aren't available for this meeting."
    />
  );
}
