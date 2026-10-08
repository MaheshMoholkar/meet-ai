"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { BotIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataPagination } from "@/components/data-pagination";
import { DataTable } from "@/components/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/state-views";
import { useTRPC } from "@/trpc/client";

import { useAgentsFilters } from "../../hooks/use-agents-filters";
import { columns } from "../components/columns";

export function AgentsView() {
  const trpc = useTRPC();
  const router = useRouter();
  const [filters, setFilters] = useAgentsFilters();
  const { data } = useSuspenseQuery(trpc.agents.getMany.queryOptions({ ...filters }));

  if (data.total === 0 && !filters.search) {
    return (
      <div className="flex-1 border-t">
        <EmptyState
          icon={BotIcon}
          title="Create your first agent"
          description="An agent is the AI you'll talk to in meetings. Give it a name and instructions for how it should behave."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <DataTable data={data.items} columns={columns} onRowClick={(row) => router.push(`/agents/${row.id}`)} />
      <DataPagination
        page={filters.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ page })}
      />
    </div>
  );
}

export function AgentsViewLoading() {
  return <LoadingState label="Loading agents" />;
}

export function AgentsViewError() {
  return <ErrorState title="Couldn't load agents" description="Please try again later" />;
}
