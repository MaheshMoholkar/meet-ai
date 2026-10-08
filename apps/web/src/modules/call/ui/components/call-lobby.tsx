"use client";

import { Loader2Icon, LogInIcon, MicIcon, OctagonAlertIcon } from "lucide-react";
import Link from "next/link";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { CallCard, CallCardTitle } from "./call-card";

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
    <CallCard>
      <GeneratedAvatar seed={agentName} variant="botttsNeutral" className="size-16" />
      <div className="flex flex-col gap-y-2">
        <CallCardTitle>{meetingName}</CallCardTitle>
        <p className="text-sm text-muted-foreground">
          You&apos;ll talk with <span className="font-semibold text-foreground">{agentName}</span>. The call is
          recorded and transcribed for your summary.
        </p>
      </div>
      <p className="flex items-center gap-x-2 text-[13px] leading-[18px] text-muted-foreground">
        <MicIcon className="size-4" />
        Your browser will ask for microphone access.
      </p>
      {error && (
        <Alert variant="destructive">
          <OctagonAlertIcon />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}
      <div className="flex w-full justify-between gap-x-2">
        <Button asChild variant="ghost" size="lg">
          <Link href={`/meetings/${meetingId}`}>Cancel</Link>
        </Button>
        <Button variant="call" size="lg" onClick={onJoin} disabled={joining}>
          {joining ? <Loader2Icon className="animate-spin" /> : <LogInIcon />}
          {joining ? "Connecting…" : "Join call"}
        </Button>
      </div>
    </CallCard>
  );
}
