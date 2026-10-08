"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { GeneratedAvatar } from "@/components/generated-avatar";

import type { AgentsGetMany } from "../../types";

export const columns: ColumnDef<AgentsGetMany[number]>[] = [
  {
    accessorKey: "name",
    header: "Agent",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <GeneratedAvatar variant="botttsNeutral" seed={row.original.name} />
        {/* The row is clickable; this link is what a keyboard reaches. */}
        <Link
          href={`/agents/${row.original.id}`}
          onClick={(event) => event.stopPropagation()}
          className="focus-ring block max-w-[45vw] truncate rounded-sm font-semibold sm:max-w-64"
        >
          {row.original.name}
        </Link>
      </div>
    ),
  },
  {
    accessorKey: "instructions",
    header: "Instructions",
    meta: { className: "hidden lg:table-cell" },
    cell: ({ row }) => (
      <span className="block max-w-72 truncate text-[13px] leading-[18px] text-muted-foreground xl:max-w-[420px]">
        {row.original.instructions}
      </span>
    ),
  },
  {
    accessorKey: "meetingCount",
    header: "Meetings",
    cell: ({ row }) => (
      <span className="timecode">
        {row.original.meetingCount} {row.original.meetingCount === 1 ? "meeting" : "meetings"}
      </span>
    ),
  },
];
