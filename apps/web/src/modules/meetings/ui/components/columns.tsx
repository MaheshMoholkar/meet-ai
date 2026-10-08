"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { formatDuration, formatShortDate } from "@/lib/utils";

import type { MeetingsGetMany } from "../../types";
import { StatusBadge } from "./status-badge";

export const columns: ColumnDef<MeetingsGetMany[number]>[] = [
  {
    accessorKey: "name",
    header: "Meeting",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <GeneratedAvatar variant="botttsNeutral" seed={row.original.agent.name} />
        <div className="min-w-0">
          {/* The row is clickable; this link is what a keyboard reaches. */}
          <Link
            href={`/meetings/${row.original.id}`}
            onClick={(event) => event.stopPropagation()}
            className="focus-ring block max-w-[38vw] truncate rounded-sm font-semibold sm:max-w-64 md:max-w-40 lg:max-w-96"
          >
            {row.original.name}
          </Link>
          <span className="block max-w-[38vw] truncate text-[13px] leading-[18px] text-muted-foreground sm:max-w-64 md:max-w-40 lg:max-w-96">
            with {row.original.agent.name}
            {row.original.startedAt && `, ${formatShortDate(row.original.startedAt)}`}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "duration",
    header: "Duration",
    // The duration is on the meeting's page; phones keep the name and the status.
    meta: { className: "hidden sm:table-cell" },
    cell: ({ row }) =>
      row.original.duration ? (
        <span className="timecode">{formatDuration(row.original.duration)}</span>
      ) : (
        <span className="timecode text-muted-foreground">No duration</span>
      ),
  },
];
