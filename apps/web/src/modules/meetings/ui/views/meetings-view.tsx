"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { VideoIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataPagination } from "@/components/data-pagination";
import { DataTable } from "@/components/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/state-views";
import { useTRPC } from "@/trpc/client";

import { useMeetingsFilters } from "../../hooks/use-meetings-filters";
import { columns } from "../components/columns";

export function MeetingsView() {
  const trpc = useTRPC();
  const router = useRouter();
  const [filters, setFilters] = useMeetingsFilters();
  const { data } = useSuspenseQuery(trpc.meetings.getMany.queryOptions({ ...filters }));

  const hasFilters = Boolean(filters.search || filters.status || filters.agentId);

  if (data.total === 0 && !hasFilters) {
    return (
      <div className="flex-1 border-t">
        <EmptyState
          icon={VideoIcon}
          title="Create your first meeting"
          description="A meeting is a voice call with one of your agents. Afterwards you'll get a transcript, a recording and a summary."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <DataTable data={data.items} columns={columns} onRowClick={(row) => router.push(`/meetings/${row.id}`)} />
      <DataPagination
        page={filters.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ page })}
      />
    </div>
  );
}

export function MeetingsViewLoading() {
  return <LoadingState label="Loading meetings" />;
}

export function MeetingsViewError() {
  return <ErrorState title="Couldn't load meetings" description="Please try again later" />;
}
