"use client";

import { BookOpenTextIcon, FileTextIcon, SparklesIcon } from "lucide-react";
import { Suspense, useRef } from "react";

import { Prose } from "@/components/prose";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { MeetingGetOne } from "../../types";
import { AskAi } from "./ask-ai";
import { Recording } from "./recording";
import { Transcript } from "./transcript";

/**
 * A finished meeting: the recording as one strip you can listen to while you
 * read, then Summary, Transcript and Ask AI.
 */
export function CompletedState({ data }: { data: MeetingGetOne }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasRecording = Boolean(data.recordingKey);

  // A transcript timestamp moves the recording to that moment.
  const seek = (ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = ms / 1000;
    void audio.play();
  };

  return (
    <div className="flex flex-col gap-y-5">
      <Recording
        meetingId={data.id}
        hasRecording={hasRecording}
        durationSeconds={data.duration}
        audioRef={audioRef}
      />
      <Tabs defaultValue="summary" className="gap-y-6">
        <TabsList variant="line">
          <TabsTrigger value="summary">
            <BookOpenTextIcon />
            Summary
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <FileTextIcon />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="ask">
            {/* The agent's tab: its icon stays blue, selected or not. */}
            <SparklesIcon className="text-agent-text" />
            Ask AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Prose>{data.summary ?? ""}</Prose>
        </TabsContent>
        <TabsContent value="transcript">
          <Transcript meetingId={data.id} onSeek={hasRecording ? seek : undefined} />
        </TabsContent>
        <TabsContent value="ask">
          <Suspense fallback={<p className="text-[13px] leading-[18px] text-muted-foreground">Loading chat…</p>}>
            <AskAi meetingId={data.id} agentName={data.agent.name} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
