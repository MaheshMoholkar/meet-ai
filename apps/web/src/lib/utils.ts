export { cn } from "cn";

/** "1h", "12m", "45s": the largest whole unit, rounded. Replaces humanize-duration. */
export function formatDuration(seconds: number) {
  const units = [
    { suffix: "h", size: 3600 },
    { suffix: "m", size: 60 },
    { suffix: "s", size: 1 },
  ];
  const safe = Math.max(0, seconds);

  for (const { suffix, size } of units) {
    if (safe >= size || size === 1) {
      return `${Math.round(safe / size)}${suffix}`;
    }
  }

  return "0s";
}

const longDate = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** "October 3, 2026". */
export const formatLongDate = (date: Date) => longDate.format(date);

/** "Oct 3". */
export const formatShortDate = (date: Date) => shortDate.format(date);

/** "07:05" from milliseconds; minutes keep counting past 59. */
export function formatTimestamp(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
