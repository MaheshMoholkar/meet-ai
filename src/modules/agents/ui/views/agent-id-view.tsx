"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { VideoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EntityHeader } from "@/components/entity-header";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { ErrorState, LoadingState } from "@/components/state-views";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/hooks/use-confirm";
import { useTRPC } from "@/trpc/client";

import { UpdateAgentDialog } from "../components/agent-dialogs";

export function AgentIdView({ agentId }: { agentId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data } = useSuspenseQuery(trpc.agents.getOne.queryOptions({ id: agentId }));

  const [confirmDialog, confirm] = useConfirm(
    "Delete this agent?",
    `This also deletes its ${data.meetingCount} ${data.meetingCount === 1 ? "meeting" : "meetings"}.`,
  );

  const removeAgent = useMutation(
    trpc.agents.remove.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.agents.getMany.queryFilter()),
          queryClient.invalidateQueries(trpc.meetings.pathFilter()),
        ]);
        router.push("/agents");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const onRemove = async () => {
    if (!(await confirm())) return;
    removeAgent.mutate({ id: agentId });
  };

  return (
    <>
      {confirmDialog}
      <UpdateAgentDialog open={editOpen} onOpenChange={setEditOpen} initialValues={data} />
      <div className="flex flex-1 flex-col gap-y-4 px-4 py-4 md:px-8">
        <EntityHeader
          parentLabel="My agents"
          parentHref="/agents"
          title={data.name}
          onEdit={() => setEditOpen(true)}
          onRemove={onRemove}
        />
        <div className="rounded-lg border bg-background">
          <div className="flex flex-col gap-y-5 px-4 py-5">
            <div className="flex items-center gap-x-3">
              <GeneratedAvatar variant="botttsNeutral" seed={data.name} className="size-10" />
              <h2 className="text-2xl font-medium">{data.name}</h2>
            </div>
            <Badge variant="outline" className="flex items-center gap-x-2 [&>svg]:size-4">
              <VideoIcon className="text-blue-700" />
              {data.meetingCount} {data.meetingCount === 1 ? "meeting" : "meetings"}
            </Badge>
            <div className="flex flex-col gap-y-4">
              <p className="text-lg font-medium">Instructions</p>
              <p className="whitespace-pre-wrap text-neutral-800">{data.instructions}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function AgentIdViewLoading() {
  return <LoadingState title="Loading agent" description="This may take a few seconds" />;
}

export function AgentIdViewError() {
  return <ErrorState title="Couldn't load this agent" description="It may have been deleted, or it isn't yours." />;
}
