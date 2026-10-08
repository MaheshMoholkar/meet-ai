"use client";

import {
  useConnectionState,
  useDisconnectButton,
  useIsRecording,
  useMultibandTrackVolume,
  useTrackToggle,
  useVoiceAssistant,
  type AgentState,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { MicIcon, MicOffIcon, PhoneOffIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { VoiceBars, type VoiceState } from "@/components/voice-bars";
import { cn, formatTimestamp } from "@/lib/utils";

const stateLabels: Record<AgentState, string> = {
  disconnected: "Disconnected",
  connecting: "Waiting for the agent…",
  "pre-connect-buffering": "Waiting for the agent…",
  failed: "The agent couldn't join",
  initializing: "Agent is joining…",
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
};

const voiceStates: Partial<Record<AgentState, VoiceState>> = {
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
};

const AGENT_BARS = 7;
const MIC_BARS = 5;
const silent = (count: number) => new Array<number>(count).fill(0);

/** The live call: the one place both voices are visible at once. */
export function CallActive({ meetingName, agentName }: { meetingName: string; agentName: string }) {
  const connection = useConnectionState();
  const { state, audioTrack } = useVoiceAssistant();

  const connected = connection === ConnectionState.Connected;
  const label = connected ? (stateLabels[state] ?? state) : "Connecting…";
  const voice: VoiceState = connected ? (voiceStates[state] ?? "idle") : "idle";

  return (
    <div className="flex h-full flex-col gap-y-4 p-5">
      <header className="flex items-center gap-x-3">
        <Link href="/meetings" aria-label="Back to meetings" className="focus-ring shrink-0 rounded-md">
          <Logo className="size-7" />
        </Link>
        <h1 className="truncate text-sm font-semibold">{meetingName}</h1>
        <CallClock running={connected} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-y-6 text-center">
        <GeneratedAvatar seed={agentName} variant="botttsNeutral" className="size-32" />
        <div className="flex flex-col items-center gap-y-3">
          <p className="font-heading text-[40px] leading-[44px] font-semibold tracking-[-0.025em]">{agentName}</p>
          <p
            aria-live="polite"
            className={cn(
              "flex h-7 items-center rounded-full px-3 text-[13px] font-medium",
              voice === "speaking" ? "bg-agent-soft text-agent-text" : "bg-secondary text-foreground",
            )}
          >
            {label}
          </p>
        </div>
        <AgentBars state={voice} trackRef={audioTrack} />
      </main>

      <footer className="flex justify-center">
        <CallDock />
      </footer>
    </div>
  );
}

/** Time on the call, and the product's only red dot while it is being recorded. */
function CallClock({ running }: { running: boolean }) {
  const recording = useIsRecording();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  return (
    <p className="ml-auto flex shrink-0 items-center gap-x-2 text-muted-foreground">
      {recording && <span aria-hidden="true" className="size-2 rounded-full bg-destructive-solid" />}
      <span className="timecode">
        {recording && "Recording "}
        {formatTimestamp(seconds * 1000)}
      </span>
    </p>
  );
}

/** The agent's voice: seven bars that follow its audio, or rest as dots while it listens or thinks. */
function AgentBars({
  state,
  trackRef,
}: {
  state: VoiceState;
  trackRef: ReturnType<typeof useVoiceAssistant>["audioTrack"];
}) {
  const levels = useMultibandTrackVolume(trackRef, { bands: AGENT_BARS, loPass: 100, hiPass: 200 });

  return (
    <VoiceBars
      size="lg"
      speaker="agent"
      state={state}
      levels={levels.length === AGENT_BARS ? levels : silent(AGENT_BARS)}
    />
  );
}

/** Your microphone and the way out. */
function CallDock() {
  const { buttonProps: micProps, enabled, track } = useTrackToggle({ source: Track.Source.Microphone });
  const { buttonProps: leaveProps } = useDisconnectButton({});
  const levels = useMultibandTrackVolume(track?.audioTrack, { bands: MIC_BARS });

  return (
    <div className="flex items-center gap-x-3 rounded-full border bg-card p-2">
      <button
        {...micProps}
        // The label says what pressing does, so it isn't also announced as a pressed toggle.
        aria-pressed={undefined}
        type="button"
        className={cn(
          "focus-ring flex h-10 items-center gap-x-3 rounded-full pr-4 pl-3 text-sm font-semibold transition-colors disabled:opacity-50",
          enabled ? "bg-secondary text-foreground" : "bg-destructive-soft text-destructive",
        )}
      >
        {enabled ? <MicIcon className="size-4" /> : <MicOffIcon className="size-4" />}
        {/* Your level is the only place your yellow moves. */}
        <VoiceBars
          size="sm"
          speaker={enabled ? "you" : "muted"}
          state={enabled ? "speaking" : "idle"}
          levels={enabled && levels.length === MIC_BARS ? levels : silent(MIC_BARS)}
        />
        {enabled ? "Mute" : "Unmute"}
      </button>
      {/* Leaving ends the meeting: the one solid red button outside a delete confirm. */}
      <Button {...leaveProps} type="button" variant="danger" size="lg" className="rounded-full">
        <PhoneOffIcon />
        Leave
      </Button>
    </div>
  );
}
