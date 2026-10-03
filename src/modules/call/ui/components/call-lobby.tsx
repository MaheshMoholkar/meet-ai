"use client";

import { LogInIcon, MicIcon, OctagonAlertIcon } from "lucide-react";
import Link from "next/link";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Props {
  meetingId: string;
  meetingName: string;
  agentName: string;
  joining: boolean;
  error?: string;
  onJoin: () => void;
}

export function CallLobby({ meetingId, meetingName, agentName, joining, error, onJoin }: Props) {
  return (
    <div className="flex h-full items-center justify-center bg-radial from-sidebar-accent to-sidebar px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-y-6 rounded-xl bg-background p-10 text-foreground shadow-sm">
        <GeneratedAvatar seed={agentName} variant="botttsNeutral" className="size-20" />
        <div className="flex flex-col gap-y-2 text-center">
          <h1 className="text-lg font-medium">{meetingName}</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ll talk with <span className="font-medium text-foreground capitalize">{agentName}</span>.
            The call is recorded and transcribed for your summary.
          </p>
        </div>
        <p className="flex items-center gap-x-2 text-xs text-muted-foreground">
          <MicIcon className="size-4" />
          Your browser will ask for microphone access.
        </p>
        {error && (
          <Alert variant="destructive" className="border-none bg-destructive/10">
            <OctagonAlertIcon />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}
        <div className="flex w-full justify-between gap-x-2">
          <Button asChild variant="ghost">
            <Link href={`/meetings/${meetingId}`}>Cancel</Link>
          </Button>
          <Button onClick={onJoin} disabled={joining}>
            <LogInIcon />
            {joining ? "Connecting…" : "Join call"}
          </Button>
        </div>
      </div>
    </div>
  );
}
