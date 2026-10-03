import { describe, expect, it } from "vitest";

import { formatDuration, formatLongDate, formatShortDate, formatTimestamp } from "./utils";

describe("formatDuration", () => {
  it("uses the largest whole unit", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(150)).toBe("3m");
    expect(formatDuration(5400)).toBe("2h");
  });

  it("never goes negative", () => {
    expect(formatDuration(-5)).toBe("0s");
  });
});

describe("date formatting", () => {
  const date = new Date(2026, 9, 3, 12);

  it("formats long and short dates", () => {
    expect(formatLongDate(date)).toBe("October 3, 2026");
    expect(formatShortDate(date)).toBe("Oct 3");
  });

  it("formats call timestamps as mm:ss", () => {
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(65_400)).toBe("01:05");
    expect(formatTimestamp(3_725_000)).toBe("62:05");
  });
});
