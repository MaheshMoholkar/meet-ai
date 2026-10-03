"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ClockFadingIcon, CornerDownRightIcon } from "lucide-react";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration, formatShortDate } from "@/lib/utils";

import type { MeetingsGetMany } from "../../types";
import { statusMeta } from "../status";

export const columns: ColumnDef<MeetingsGetMany[number]>[] = [
  {
    accessorKey: "name",
    header: "Meeting",
    cell: ({ row }) => (
      <div className="flex flex-col gap-y-1">
        <span className="font-semibold capitalize">{row.original.name}</span>
        <div className="flex items-center gap-x-2">
          <div className="flex items-center gap-x-1">
            <CornerDownRightIcon className="size-3 text-muted-foreground" />
            <span className="max-w-50 truncate text-sm text-muted-foreground capitalize">
              {row.original.agent.name}
            </span>
          </div>
          <GeneratedAvatar variant="botttsNeutral" seed={row.original.agent.name} className="size-4" />
          {row.original.startedAt && (
            <span className="text-sm text-muted-foreground">{formatShortDate(row.original.startedAt)}</span>
          )}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const { label, icon: Icon, className, spin } = statusMeta[row.original.status];
      return (
        <Badge variant="outline" className={cn("[&>svg]:size-4", className)}>
          <Icon className={cn(spin && "animate-spin")} />
          {label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => (
      <Badge variant="outline" className="flex items-center gap-x-2 [&>svg]:size-4">
        <ClockFadingIcon className="text-blue-700" />
        {row.original.duration ? formatDuration(row.original.duration) : "No duration"}
      </Badge>
    ),
  },
];
