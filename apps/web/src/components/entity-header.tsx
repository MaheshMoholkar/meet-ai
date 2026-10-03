"use client";

import { MoreVerticalIcon, PencilIcon, TrashIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  parentLabel: string;
  parentHref: string;
  title: string;
  onEdit: () => void;
  onRemove: () => void;
}

/** Breadcrumb plus an edit/delete menu, shared by the agent and meeting detail pages. */
export function EntityHeader({ parentLabel, parentHref, title, onEdit, onRemove }: Props) {
  return (
    <div className="flex items-center justify-between gap-x-4">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-x-2 text-xl">
        <Link href={parentHref} className="font-medium text-muted-foreground hover:text-foreground">
          {parentLabel}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="truncate font-medium text-foreground">{title}</span>
      </nav>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions">
            <MoreVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon className="size-4 text-foreground" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRemove} variant="destructive">
            <TrashIcon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
