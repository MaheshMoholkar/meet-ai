import { VoiceBars } from "@/components/voice-bars";
import { cn } from "@/lib/utils";

import type { MeetingStatus } from "../../schemas";
import { statusMeta } from "../status";

/** A status's glyph. Active is three live voice bars, not an icon. */
export function StatusIcon({ status, className }: { status: MeetingStatus; className?: string }) {
  if (status === "active") {
    return (
      <VoiceBars
        size="xs"
        speaker="inherit"
        animate
        levels={[0.5, 1, 0.7]}
        className={cn("justify-center", className)}
      />
    );
  }

  const { icon: Icon, spin } = statusMeta[status];
  return <Icon className={cn(className, spin && "animate-spin")} />;
}

/** Where a meeting is in its life. Every status carries its word and its own glyph. */
export function StatusBadge({ status }: { status: MeetingStatus }) {
  const { label, className } = statusMeta[status];

  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border pr-2.5 pl-2 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <StatusIcon status={status} className="size-3.5" />
      {label}
    </span>
  );
}
