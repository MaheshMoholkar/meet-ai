import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { CallCard, CallCardTitle } from "./call-card";

export function CallEnded({ meetingId }: { meetingId: string }) {
  return (
    <CallCard>
      {/* Completion is quiet: an ink tick, no green. */}
      <div className="flex size-11 items-center justify-center rounded-lg bg-muted">
        <CheckIcon className="size-5" />
      </div>
      <div className="flex flex-col gap-y-2">
        <CallCardTitle>You left the call</CallCardTitle>
        <p className="text-sm text-muted-foreground">
          The transcript and summary will be ready in a minute or two.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href={`/meetings/${meetingId}`}>Back to the meeting</Link>
      </Button>
    </CallCard>
  );
}
