"use client";

import { useChat } from "@ai-sdk/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { SendIcon } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
    <div className="flex flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex max-h-[calc(100svh-22rem)] min-h-64 flex-col gap-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">
            Ask about this meeting: decisions, follow-ups, anything that was said.
          </p>
        )}
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={cn("flex gap-x-3", isUser && "flex-row-reverse")}>
              {!isUser && <GeneratedAvatar seed={agentName} variant="botttsNeutral" className="size-7" />}
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  isUser ? "bg-primary text-primary-foreground" : "bg-muted [&_p]:mb-2 [&_p:last-child]:mb-0",
                )}
              >
                {isUser ? textOf(message) : <Markdown>{textOf(message)}</Markdown>}
              </div>
            </div>
          );
        })}
        {status === "submitted" && <p className="text-sm text-muted-foreground">Thinking…</p>}
        {error && <p className="text-sm text-destructive">Something went wrong. Please try again.</p>}
      </div>
      <form onSubmit={submit} className="flex items-end gap-x-2 border-t p-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) submit(event);
          }}
          placeholder="Ask a question about this meeting"
          aria-label="Ask a question about this meeting"
          rows={1}
          className="min-h-10 resize-none"
        />
        <Button type="submit" size="icon-lg" disabled={busy || !draft.trim()} aria-label="Send">
          <SendIcon />
        </Button>
      </form>
    </div>
  );
}
