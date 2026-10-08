import { Children } from "react";
import Markdown, { type Components } from "react-markdown";

import { cn } from "@/lib/utils";

// "00:07", "00:07–00:16", optionally in parentheses, as the summariser writes them into headings.
const TIME = /(\(?\d{1,3}:\d{2}(?:\s?[–-]\s?\d{1,3}:\d{2})?\)?)/g;

/** Sets time ranges inside a heading in the `timecode` style. */
function withTimes(children: React.ReactNode): React.ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    return child.split(TIME).map((part, index) =>
      index % 2 === 1 ? (
        <span key={index} className="timecode text-muted-foreground">
          {part.replace(/[()]/g, "")}
        </span>
      ) : (
        part
      ),
    );
  });
}

// Blocks sit one step apart; a heading's own content follows closer.
const flow = "mt-4 first:mt-0 [h1+&]:mt-2 [h2+&]:mt-2 [h3+&]:mt-2 [h4+&]:mt-2";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 font-heading text-2xl leading-[30px] font-semibold tracking-[-0.015em] first:mt-0">
      {withTimes(children)}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 font-heading text-lg leading-[26px] font-semibold tracking-[-0.01em] first:mt-0">
      {withTimes(children)}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mt-6 font-semibold first:mt-0">{withTimes(children)}</h3>,
  h4: ({ children }) => <h4 className="mt-4 font-semibold first:mt-0">{withTimes(children)}</h4>,
  p: ({ children }) => <p className={flow}>{children}</p>,
  ul: ({ children }) => <ul className={cn(flow, "list-disc pl-5 marker:text-muted-foreground")}>{children}</ul>,
  ol: ({ children }) => <ol className={cn(flow, "list-decimal pl-5 marker:text-muted-foreground")}>{children}</ol>,
  li: ({ children }) => <li className="mt-1.5 first:mt-0">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} className="focus-ring rounded-sm text-agent-text underline underline-offset-4">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded-sm bg-muted px-[5px] py-0.5 font-mono text-[0.875em]">{children}</code>
  ),
  blockquote: ({ children }) => (
    <blockquote className={cn(flow, "border-l-2 pl-4 text-muted-foreground italic")}>{children}</blockquote>
  ),
};

interface Props {
  /** Markdown. */
  children: string;
  /** `default` (16/26) for the summary; `sm` (14/22) for answers in Ask AI. */
  size?: "default" | "sm";
  className?: string;
}

/** The reading surface: a meeting's summary and the agent's answers, straight on the canvas. */
export function Prose({ children, size = "default", className }: Props) {
  return (
    <div
      className={cn(
        "max-w-[68ch]",
        size === "default" ? "text-base leading-[26px]" : "text-sm leading-[22px]",
        className,
      )}
    >
      <Markdown components={components}>{children}</Markdown>
    </div>
  );
}
