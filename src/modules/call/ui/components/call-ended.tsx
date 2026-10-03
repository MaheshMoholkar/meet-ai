import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function CallEnded({ meetingId }: { meetingId: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-radial from-sidebar-accent to-sidebar px-4">
      <div className="flex max-w-md flex-col items-center gap-y-6 rounded-xl bg-background p-10 text-center text-foreground shadow-sm">
        <CheckCircle2Icon className="size-8 text-emerald-600" />
        <div className="flex flex-col gap-y-2">
          <h1 className="text-lg font-medium">You left the call</h1>
          <p className="text-sm text-muted-foreground">
            The transcript and summary will be ready in a minute or two.
          </p>
        </div>
        <Button asChild>
          <Link href={`/meetings/${meetingId}`}>Back to the meeting</Link>
        </Button>
      </div>
    </div>
  );
}
