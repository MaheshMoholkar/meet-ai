import {
  CircleCheckIcon,
  CircleXIcon,
  ClockArrowUpIcon,
  LoaderIcon,
  RadioIcon,
  type LucideIcon,
} from "lucide-react";

import type { MeetingStatus } from "../schemas";

/**
 * Tinted means the meeting wants something from you; outlined means it is
 * taking care of itself. Completed is the resting state and stays quiet.
 */
export const statusMeta: Record<
  MeetingStatus,
  { label: string; icon: LucideIcon; className: string; spin?: boolean }
> = {
  upcoming: {
    label: "Upcoming",
    icon: ClockArrowUpIcon,
    // Waiting on you.
    className: "border-transparent bg-you-soft text-foreground [&>svg]:text-you-text",
  },
  active: {
    label: "Active",
    // Drawn as live voice bars in the badge; the icon is for places that need one.
    icon: RadioIcon,
    // The agent is on the line.
    className: "border-transparent bg-agent-soft text-agent-text",
  },
  processing: {
    label: "Processing",
    icon: LoaderIcon,
    className: "border-border text-foreground [&>svg]:text-muted-foreground",
    spin: true,
  },
  completed: {
    label: "Completed",
    icon: CircleCheckIcon,
    className: "border-border text-foreground [&>svg]:text-muted-foreground",
  },
  failed: {
    label: "Failed",
    icon: CircleXIcon,
    className: "border-transparent bg-destructive-soft text-destructive",
  },
};
