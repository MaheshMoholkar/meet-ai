import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";
type Speaker = "agent" | "you" | "muted" | "inherit";
export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const sizes: Record<Size, string> = {
  xs: "h-3 gap-0.5 [--bar:3px]",
  sm: "h-8 gap-1 [--bar:6px]",
  md: "h-24 gap-2 [--bar:12px]",
  lg: "h-42 gap-3 [--bar:20px]",
};

// Colour is who is speaking. Nothing else is ever drawn as bars.
const speakers: Record<Speaker, string> = {
  agent: "text-agent",
  you: "text-you",
  muted: "text-muted-foreground",
  inherit: "",
};

// Offsets that keep neighbouring bars out of step.
const delays = [-820, -340, -610, -120, -470, -700, -250];

interface Props {
  /** One value per bar, 0 to 1: the audio level, or a fixed shape when `animate` is set. */
  levels: number[];
  state?: VoiceState;
  speaker?: Speaker;
  size?: Size;
  /** Loop a CSS animation instead of following live levels (the Active status glyph). */
  animate?: boolean;
  /** Text alternative. Leave it out when the state is written next to the bars. */
  label?: string;
  className?: string;
}

/**
 * Sound, drawn as upright pills. Full-size bars belong on a Night surface,
 * where both voice colours hold 3:1; on Light only the `xs` glyph inside a
 * labelled pill appears.
 */
export function VoiceBars({
  levels,
  state = "speaking",
  speaker = "agent",
  size = "md",
  animate = false,
  label,
  className,
}: Props) {
  const resting = state === "idle" || state === "listening" || state === "thinking";

  return (
    <span
      data-slot="voice-bars"
      data-state={state}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 items-center", sizes[size], speakers[speaker], className)}
    >
      {levels.map((level, index) => (
        <span
          key={index}
          className={cn(
            "block min-h-(--bar) w-(--bar) rounded-full bg-current",
            state === "idle" && "opacity-60",
            state === "listening" && "animate-[voice-listen_1600ms_ease-in-out_infinite]",
            state === "thinking" && "animate-[voice-think_1200ms_ease-in-out_infinite]",
            state === "speaking" &&
              (animate
                ? "animate-[voice-speak_900ms_ease-in-out_infinite_alternate]"
                : "transition-[height] duration-75 ease-out"),
          )}
          style={{
            height: resting ? undefined : `${Math.round(Math.min(1, Math.max(0, level)) * 100)}%`,
            animationDelay:
              state === "thinking" ? `${index * 110}ms` : `${delays[index % delays.length]}ms`,
          }}
        />
      ))}
    </span>
  );
}
