"use client";

import { BookOpenTextIcon, ClockFadingIcon, FileAudioIcon, FileTextIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import Markdown from "react-markdown";
import { Suspense } from "react";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDuration, formatLongDate } from "@/lib/utils";

import type { MeetingGetOne } from "../../types";
import { AskAi } from "./ask-ai";
import { Recording } from "./recording";
import { Transcript } from "./transcript";

const tabs = [
  { value: "summary", label: "Summary", icon: BookOpenTextIcon },
  { value: "transcript", label: "Transcript", icon: FileTextIcon },
  { value: "recording", label: "Recording", icon: FileAudioIcon },
  { value: "ask", label: "Ask AI", icon: SparklesIcon },
] as const;

const markdownComponents = {
  h1: (props: React.ComponentProps<"h1">) => <h1 className="mb-6 text-2xl font-medium" {...props} />,
  h2: (props: React.ComponentProps<"h2">) => <h2 className="mb-6 text-xl font-medium" {...props} />,
  h3: (props: React.ComponentProps<"h3">) => <h3 className="mb-4 text-lg font-medium" {...props} />,
  h4: (props: React.ComponentProps<"h4">) => <h4 className="mb-3 text-base font-medium" {...props} />,
  p: (props: React.ComponentProps<"p">) => <p className="mb-6 leading-relaxed" {...props} />,
  ul: (props: React.ComponentProps<"ul">) => <ul className="mb-6 list-inside list-disc" {...props} />,
  ol: (props: React.ComponentProps<"ol">) => <ol className="mb-6 list-inside list-decimal" {...props} />,
  li: (props: React.ComponentProps<"li">) => <li className="mb-1" {...props} />,
  strong: (props: React.ComponentProps<"strong">) => <strong className="font-semibold" {...props} />,
  code: (props: React.ComponentProps<"code">) => <code className="rounded bg-muted px-1 py-0.5" {...props} />,
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote className="my-4 border-l-4 pl-4 italic" {...props} />
  ),
};

export function CompletedState({ data }: { data: MeetingGetOne }) {
  return (
    <Tabs defaultValue="summary" className="gap-y-4">
      <div className="rounded-lg border bg-background px-3">
        <ScrollArea>
          <TabsList variant="line" className="h-13 justify-start bg-background p-0">
            {tabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="h-full">
                <Icon />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <TabsContent value="summary">
        <div className="flex flex-col gap-y-5 rounded-lg border bg-background px-4 py-5">
          <h2 className="text-2xl font-medium capitalize">{data.name}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link
              href={`/agents/${data.agent.id}`}
              className="flex items-center gap-x-2 capitalize underline underline-offset-4"
            >
              <GeneratedAvatar variant="botttsNeutral" seed={data.agent.name} className="size-5" />
              {data.agent.name}
            </Link>
            {data.startedAt && <span className="text-muted-foreground">{formatLongDate(data.startedAt)}</span>}
            <Badge variant="outline" className="flex items-center gap-x-2 [&>svg]:size-4">
              <ClockFadingIcon className="text-blue-700" />
              {data.duration ? formatDuration(data.duration) : "No duration"}
            </Badge>
          </div>
          <div className="flex items-center gap-x-2 text-sm text-muted-foreground">
            <SparklesIcon className="size-4" />
            General summary
          </div>
          <div>
            <Markdown components={markdownComponents}>{data.summary ?? ""}</Markdown>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="transcript">
        <Transcript meetingId={data.id} />
      </TabsContent>
      <TabsContent value="recording">
        <Recording meetingId={data.id} hasRecording={Boolean(data.recordingKey)} />
      </TabsContent>
      <TabsContent value="ask">
        <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading chat…</p>}>
          <AskAi meetingId={data.id} agentName={data.agent.name} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
