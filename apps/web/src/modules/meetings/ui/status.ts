import {
  CircleCheckIcon,
  CircleXIcon,
  ClockArrowUpIcon,
  LoaderIcon,
  RadioIcon,
  type LucideIcon,
} from "lucide-react";

import type { MeetingStatus } from "../schemas";

export const statusMeta: Record<
  MeetingStatus,
  { label: string; icon: LucideIcon; className: string; spin?: boolean }
> = {
  upcoming: {
    label: "Upcoming",
    icon: ClockArrowUpIcon,
    className: "bg-yellow-500/20 text-yellow-800 border-yellow-800/5",
  },
  active: {
    label: "Active",
    icon: RadioIcon,
    className: "bg-blue-500/20 text-blue-800 border-blue-800/5",
  },
  processing: {
    label: "Processing",
    icon: LoaderIcon,
    className: "bg-gray-300/20 text-gray-800 border-gray-800/5",
    spin: true,
  },
  completed: {
    label: "Completed",
    icon: CircleCheckIcon,
    className: "bg-emerald-500/20 text-emerald-800 border-emerald-800/5",
  },
  failed: {
    label: "Failed",
    icon: CircleXIcon,
    className: "bg-rose-500/20 text-rose-800 border-rose-800/5",
  },
};
