"use client";

import { useQuery } from "@tanstack/react-query";
import { PauseIcon, PlayIcon } from "lucide-react";
import { useRef, useState } from "react";

import { cn, formatTimestamp } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

interface Props {
  meetingId: string;
  hasRecording: boolean;
  /** The meeting's stored length; used until the audio reports its own. */
  durationSeconds: number | null;
  /** Shared with the transcript, whose timestamps seek this audio. */
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const SEEK_STEP_SECONDS = 5;

/**
 * The call's audio as a timeline of who spoke when: one segment per transcript
 * turn, blue for the agent and yellow for you. Always Night, so both voice
 * colours hold 3:1 against the strip in either theme.
 */
export function Recording({ meetingId, hasRecording, durationSeconds, audioRef }: Props) {
  const trpc = useTRPC();
  // The link is valid for 15 minutes; refresh it before it expires.
  const { data: url, isPending } = useQuery({
    ...trpc.meetings.getRecordingUrl.queryOptions({ id: meetingId }),
    enabled: hasRecording,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
  // Same query the Transcript tab uses, so this costs no extra request.
  const { data: transcript } = useQuery({
    ...trpc.meetings.getTranscript.queryOptions({ id: meetingId }),
    enabled: hasRecording,
  });

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  // Survives the audio element reloading when the signed link is refreshed.
  const resume = useRef({ position: 0, playing: false });
  const trackRef = useRef<HTMLDivElement>(null);

  const strip = "dark flex items-center gap-4 rounded-lg border bg-card px-5 py-4";

  if (!hasRecording) {
    return (
      <section aria-label="Recording" className={strip}>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          There&apos;s no recording for this meeting. It may still be uploading; check back in a minute.
        </p>
      </section>
    );
  }

  const items = transcript?.items ?? [];
  const lastTurnEnd = items.length ? items[items.length - 1].endMs / 1000 : 0;
  const total = Math.max(mediaDuration, durationSeconds ?? 0, lastTurnEnd);
  const played = total > 0 ? Math.min(100, (position / total) * 100) : 0;

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || total <= 0) return;
    const next = Math.min(total, Math.max(0, seconds));
    audio.currentTime = next;
    setPosition(next);
  };

  const seekToPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const { left, width } = track.getBoundingClientRect();
    seekTo(((clientX - left) / width) * total);
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const segments = items.map((item) => (
    <span
      key={`${item.speaker}-${item.startMs}`}
      className={cn(
        "absolute top-1/2 h-3 -translate-y-1/2 rounded-full",
        item.speaker === "agent" ? "bg-agent" : "bg-you",
      )}
      style={{
        left: `${(item.startMs / 1000 / total) * 100}%`,
        width: `max(${((item.endMs - item.startMs) / 1000 / total) * 100}%, 4px)`,
      }}
    />
  ));

  return (
    <section aria-label="Recording" className={strip}>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          className="hidden"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(event) => {
            const audio = event.currentTarget;
            setPosition(audio.currentTime);
            resume.current = { position: audio.currentTime, playing: !audio.paused };
          }}
          onDurationChange={(event) => {
            const { duration } = event.currentTarget;
            if (Number.isFinite(duration)) setMediaDuration(duration);
          }}
          onLoadedMetadata={(event) => {
            // A refreshed link reloads the element: pick up where it was.
            const audio = event.currentTarget;
            if (resume.current.position > 0) audio.currentTime = resume.current.position;
            if (resume.current.playing) void audio.play();
          }}
        />
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pause recording" : "Play recording"}
        className="focus-ring flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary),var(--background)_14%)] disabled:opacity-50"
      >
        {playing ? <PauseIcon className="size-4 fill-current" /> : <PlayIcon className="size-4 fill-current" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Recording position"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`${formatTimestamp(position * 1000)} of ${formatTimestamp(total * 1000)}`}
          className="focus-ring relative h-8 cursor-pointer touch-none rounded-sm"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            seekToPointer(event.clientX);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) seekToPointer(event.clientX);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") seekTo(position + SEEK_STEP_SECONDS);
            else if (event.key === "ArrowLeft") seekTo(position - SEEK_STEP_SECONDS);
            else if (event.key === "Home") seekTo(0);
            else if (event.key === "End") seekTo(total);
            else if (event.key === " " || event.key === "Enter") toggle();
            else return;
            event.preventDefault();
          }}
        >
          {items.length > 0 ? (
            <>
              {/* Silence is a thin line; turns sit on it. Played turns are solid, the rest dimmed. */}
              <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-border" />
              <span className="absolute inset-0 opacity-50">{segments}</span>
              <span className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - played}% 0 0)` }}>
                {segments}
              </span>
            </>
          ) : (
            <>
              <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-secondary" />
              <span
                className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground"
                style={{ width: `${played}%` }}
              />
            </>
          )}
          <span
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: `${played}%` }}
          />
        </div>
        {items.length > 0 && transcript && (
          <div className="mt-1 flex items-center gap-x-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-x-1.5">
              <span className="h-1.5 w-3 rounded-full bg-agent" />
              {transcript.names.agent}
            </span>
            <span className="flex items-center gap-x-1.5">
              <span className="h-1.5 w-3 rounded-full bg-you" />
              You
            </span>
          </div>
        )}
      </div>

      <p className="timecode shrink-0 text-muted-foreground">
        {isPending ? (
          "Loading recording…"
        ) : (
          <>
            <span className="text-foreground">{formatTimestamp(position * 1000)}</span> /{" "}
            {formatTimestamp(total * 1000)}
          </>
        )}
      </p>
    </section>
  );
}
