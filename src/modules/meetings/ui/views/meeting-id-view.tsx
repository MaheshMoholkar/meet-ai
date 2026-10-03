"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EntityHeader } from "@/components/entity-header";
import { ErrorState, LoadingState } from "@/components/state-views";
import { useConfirm } from "@/hooks/use-confirm";
import { useTRPC } from "@/trpc/client";

import { UpdateMeetingDialog } from "../components/meeting-dialogs";
import { CompletedState } from "../components/completed-state";
import { ActiveState, FailedState, ProcessingState, UpcomingState } from "../components/meeting-states";

export function MeetingIdView({ meetingId }: { meetingId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data } = useSuspenseQuery(trpc.meetings.getOne.queryOptions({ id: meetingId }));

  const [confirmDialog, confirm] = useConfirm("Delete this meeting?", "This can't be undone.");

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

  return (
    <>
      {confirmDialog}
      <UpdateMeetingDialog open={editOpen} onOpenChange={setEditOpen} initialValues={data} />
      <div className="flex flex-1 flex-col gap-y-4 px-4 py-4 md:px-8">
        <EntityHeader
          parentLabel="My meetings"
          parentHref="/meetings"
          title={data.name}
          onEdit={() => setEditOpen(true)}
          onRemove={onRemove}
        />
        {data.status === "upcoming" && <UpcomingState meetingId={meetingId} />}
        {data.status === "active" && <ActiveState meetingId={meetingId} />}
        {data.status === "processing" && <ProcessingState />}
        {data.status === "completed" && <CompletedState data={data} />}
        {data.status === "failed" && <FailedState />}
      </div>
    </>
  );
}

export function MeetingIdViewLoading() {
  return <LoadingState title="Loading meeting" description="This may take a few seconds" />;
}

export function MeetingIdViewError() {
  return <ErrorState title="Couldn't load this meeting" description="It may have been deleted, or it isn't yours." />;
}
