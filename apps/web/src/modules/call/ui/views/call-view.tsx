"use client";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

import { CallActive } from "../components/call-active";
import { CallCard, CallCardTitle } from "../components/call-card";
import { CallEnded } from "../components/call-ended";
import { CallLobby } from "../components/call-lobby";

type Stage = { name: "lobby" } | { name: "call"; token: string; serverUrl: string } | { name: "ended" };

export function CallView({ meetingId }: { meetingId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<Stage>({ name: "lobby" });

  const { data: meeting } = useSuspenseQuery(trpc.meetings.getOne.queryOptions({ id: meetingId }));

  const join = useMutation(
    trpc.meetings.join.mutationOptions({
      onSuccess: ({ token, serverUrl }) => setStage({ name: "call", token, serverUrl }),
    }),
  );

  const onLeft = () => {
    setStage({ name: "ended" });
    void queryClient.invalidateQueries(trpc.meetings.pathFilter());
  };

  if (stage.name === "ended") {
    return <CallEnded meetingId={meetingId} />;
  }

  if (meeting.status !== "upcoming" && meeting.status !== "active") {
    return (
      <CallMessage title="This meeting has ended" description="You can't join it again, but its results are on the meeting page.">
        <Button asChild size="lg">
          <Link href={`/meetings/${meetingId}`}>Open meeting</Link>
        </Button>
      </CallMessage>
    );
  }

  if (stage.name === "lobby") {
    return (
      <CallLobby
        meetingId={meetingId}
        meetingName={meeting.name}
        agentName={meeting.agent.name}
        joining={join.isPending}
        error={join.error?.message}
        onJoin={() => join.mutate({ id: meetingId })}
      />
    );
  }

  return (
    <LiveKitRoom
      serverUrl={stage.serverUrl}
      token={stage.token}
      connect
      audio
      video={false}
      onDisconnected={onLeft}
      className="h-full"
    >
      <CallActive meetingName={meeting.name} agentName={meeting.agent.name} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

export function CallViewLoading() {
  return (
    <div aria-busy="true" aria-label="Loading call" className="flex h-full items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function CallViewError() {
  return (
    <CallMessage title="Couldn't load this meeting" description="It may have been deleted, or it isn't yours.">
      <Button asChild variant="outline" size="lg">
        <Link href="/meetings">Back to meetings</Link>
      </Button>
    </CallMessage>
  );
}

/** A call that can't happen, said on the same card as the lobby. */
function CallMessage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <CallCard>
      <div className="flex size-11 items-center justify-center rounded-lg bg-muted">
        <CircleAlertIcon className="size-5" />
      </div>
      <div className="flex flex-col gap-y-2">
        <CallCardTitle>{title}</CallCardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </CallCard>
  );
}
