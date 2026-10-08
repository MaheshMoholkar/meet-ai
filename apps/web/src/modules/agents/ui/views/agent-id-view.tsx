"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { VideoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EntityHeader } from "@/components/entity-header";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { PageHeader } from "@/components/page-header";
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
    `This also deletes its ${data.meetingCount} ${data.meetingCount === 1 ? "meeting" : "meetings"}. It can't be undone.`,
    "Delete agent",
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
      <div className="flex flex-1 flex-col gap-y-5">
        <EntityHeader
          parentLabel="My agents"
          parentHref="/agents"
          title={data.name}
          onEdit={() => setEditOpen(true)}
          onRemove={onRemove}
        />
        <PageHeader
          title={data.name}
          leading={<GeneratedAvatar variant="botttsNeutral" seed={data.name} className="size-10" />}
          meta={
            <Badge>
              <VideoIcon />
              {data.meetingCount} {data.meetingCount === 1 ? "meeting" : "meetings"}
            </Badge>
          }
        />
        <section className="flex flex-col gap-y-2 pt-3">
          <h2 className="font-heading text-lg leading-[26px] font-semibold tracking-[-0.01em]">Instructions</h2>
          <p className="max-w-[68ch] text-base leading-[26px] whitespace-pre-wrap">{data.instructions}</p>
        </section>
      </div>
    </>
  );
}

export function AgentIdViewLoading() {
  return <LoadingState label="Loading agent" variant="page" />;
}

export function AgentIdViewError() {
  return <ErrorState title="Couldn't load this agent" description="It may have been deleted, or it isn't yours." />;
}
