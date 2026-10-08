"use client";

import { useChat } from "@ai-sdk/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUpIcon } from "lucide-react";
import { useState } from "react";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Prose } from "@/components/prose";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceBars } from "@/components/voice-bars";
import { useTRPC } from "@/trpc/client";

const textOf = (message: UIMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

export function AskAi({ meetingId, agentName }: { meetingId: string; agentName: string }) {
  const trpc = useTRPC();
  const { data: history } = useSuspenseQuery(trpc.meetings.getMessages.queryOptions({ id: meetingId }));
  const [draft, setDraft] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    id: `meeting-${meetingId}`,
    messages: history.map(
      (row): UIMessage => ({ id: row.id, role: row.role, parts: [{ type: "text", text: row.content }] }),
    ),
    transport: new DefaultChatTransport({
      api: `/api/meetings/${meetingId}/chat`,
      // The server keeps the history; send only the new question.
      prepareSendMessagesRequest: ({ messages }) => ({ body: { text: textOf(messages[messages.length - 1]) } }),
    }),
  });

  const busy = status === "submitted" || status === "streaming";

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    void sendMessage({ text });
    setDraft("");
  };

  return (
    <div className="flex max-w-[760px] flex-col gap-y-6">
      <div className="flex max-h-[calc(100svh-28rem)] min-h-64 flex-col gap-y-5 overflow-y-auto">
        {messages.length === 0 && (
          <p className="m-auto max-w-sm text-center text-[13px] leading-[18px] text-muted-foreground">
            Ask about this meeting: decisions, follow-ups, anything that was said.
          </p>
        )}
        {messages.map((message) =>
          message.role === "user" ? (
            // You: on the right, in your colour.
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-lg rounded-br-sm bg-you-soft px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
                {textOf(message)}
              </div>
            </div>
          ) : (
            // The agent: on the left, no bubble, written on the canvas.
            <div key={message.id} className="flex items-start gap-x-3">
              <GeneratedAvatar seed={agentName} variant="botttsNeutral" className="size-7" />
              <div className="min-w-0 pt-0.5">
                <p className="text-[13px] leading-[18px] font-semibold">{agentName}</p>
                <Prose size="sm">{textOf(message)}</Prose>
              </div>
            </div>
          ),
        )}
        {status === "submitted" && (
          <div className="flex items-center gap-x-3">
            <GeneratedAvatar seed={agentName} variant="botttsNeutral" className="size-7" />
            <p className="flex items-center gap-x-2 text-sm text-muted-foreground">
              <VoiceBars size="xs" state="thinking" speaker="inherit" levels={[0, 0, 0]} className="text-agent-text" />
              Thinking…
            </p>
          </div>
        )}
        {error && <p className="text-sm text-destructive">Something went wrong. Please try again.</p>}
      </div>
      <form
        onSubmit={submit}
        className="flex items-end gap-x-2 rounded-lg border border-input bg-card py-2 pr-2 pl-3 transition-colors focus-within:border-ring focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring"
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) submit(event);
          }}
          placeholder="Ask a question about this meeting"
          aria-label="Ask a question about this meeting"
          rows={1}
          className="min-h-8 flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-[5px] focus-visible:outline-0"
        />
        <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label="Send">
          <ArrowUpIcon />
        </Button>
      </form>
    </div>
  );
}
