"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { VideoIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EntityHeader } from "@/components/entity-header";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/state-views";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDuration, formatLongDate } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

import { CompletedState } from "../components/completed-state";
import { UpdateMeetingDialog } from "../components/meeting-dialogs";
import { ActiveState, FailedState, ProcessingState, UpcomingState } from "../components/meeting-states";
import { StatusBadge } from "../components/status-badge";

export function MeetingIdView({ meetingId }: { meetingId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data } = useSuspenseQuery(trpc.meetings.getOne.queryOptions({ id: meetingId }));

  const [confirmDialog, confirm] = useConfirm("Delete this meeting?", "This can't be undone.", "Delete meeting");

  const removeMeeting = useMutation(
    trpc.meetings.remove.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.meetings.getMany.queryFilter()),
          queryClient.invalidateQueries(trpc.agents.pathFilter()),
        ]);
        router.push("/meetings");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const onRemove = async () => {
    if (!(await confirm())) return;
    removeMeeting.mutate({ id: meetingId });
  };

  // Calling the agent is the one blue button in the product.
  const joinLabel =
    data.status === "upcoming" ? "Start meeting" : data.status === "active" ? "Join meeting" : null;

  return (
    <>
      {confirmDialog}
      <UpdateMeetingDialog open={editOpen} onOpenChange={setEditOpen} initialValues={data} />
      <div className="flex flex-1 flex-col gap-y-5">
        <EntityHeader
          parentLabel="My meetings"
          parentHref="/meetings"
          title={data.name}
          onEdit={() => setEditOpen(true)}
          onRemove={onRemove}
        />
        <PageHeader
          title={data.name}
          meta={
            <>
              <Link
                href={`/agents/${data.agent.id}`}
                className="focus-ring flex items-center gap-x-1.5 rounded-sm font-medium text-foreground hover:underline hover:underline-offset-4"
              >
                <GeneratedAvatar variant="botttsNeutral" seed={data.agent.name} className="size-5" />
                {data.agent.name}
              </Link>
              {data.startedAt && <span>{formatLongDate(data.startedAt)}</span>}
              {data.duration ? <span className="timecode">{formatDuration(data.duration)}</span> : null}
              <StatusBadge status={data.status} />
            </>
          }
          action={
            joinLabel && (
              <Button asChild variant="call" size="lg" className="w-full sm:w-auto">
                <Link href={`/call/${meetingId}`}>
                  <VideoIcon />
                  {joinLabel}
                </Link>
              </Button>
            )
          }
        />
        {data.status === "upcoming" && <UpcomingState />}
        {data.status === "active" && <ActiveState />}
        {data.status === "processing" && <ProcessingState />}
        {data.status === "completed" && <CompletedState data={data} />}
        {data.status === "failed" && <FailedState />}
      </div>
    </>
  );
}

export function MeetingIdViewLoading() {
  return <LoadingState label="Loading meeting" variant="page" />;
}

export function MeetingIdViewError() {
  return <ErrorState title="Couldn't load this meeting" description="It may have been deleted, or it isn't yours." />;
}
