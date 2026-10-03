"use client";

import {
  BarVisualizer,
  DisconnectButton,
  TrackToggle,
  useConnectionState,
  useVoiceAssistant,
  type AgentState,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { PhoneOffIcon } from "lucide-react";
import Link from "next/link";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Logo } from "@/components/icons";

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

export function CallActive({ meetingName, agentName }: { meetingName: string; agentName: string }) {
  const connection = useConnectionState();
  const { state, audioTrack } = useVoiceAssistant();

  const label =
    connection === ConnectionState.Connected ? (stateLabels[state] ?? state) : "Connecting…";

  return (
    <div className="flex h-full flex-col justify-between gap-y-4 p-4">
      <header className="flex items-center gap-4 rounded-full bg-[#101213] p-3 pr-6">
        <Link href="/meetings" className="flex items-center justify-center rounded-full bg-white/10 p-1.5">
          <Logo className="size-6 text-white" />
        </Link>
        <h1 className="truncate text-base">{meetingName}</h1>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-y-6">
        <GeneratedAvatar seed={agentName} variant="botttsNeutral" className="size-28 border-white/20" />
        <p className="text-xl font-medium capitalize">{agentName}</p>
        <BarVisualizer
          state={state}
          barCount={7}
          trackRef={audioTrack}
          className="h-24 w-64 [--lk-va-bar-width:24px]"
        />
        <p className="text-sm text-white/70" aria-live="polite">
          {label}
        </p>
      </main>

      <footer className="flex items-center justify-center gap-x-3 rounded-full bg-[#101213] p-3">
        <TrackToggle source={Track.Source.Microphone} aria-label="Toggle microphone">
          Microphone
        </TrackToggle>
        <DisconnectButton className="lk-disconnect-button">
          <PhoneOffIcon className="size-4" />
          Leave
        </DisconnectButton>
      </footer>
    </div>
  );
}
