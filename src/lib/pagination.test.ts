import { describe, expect, it } from "vitest";

import { containsPattern, pageOffset, totalPages } from "./pagination";

describe("pagination helpers", () => {
  it("computes offsets and page counts", () => {
    expect(pageOffset(1, 10)).toBe(0);
    expect(pageOffset(3, 10)).toBe(20);
    expect(totalPages(0, 10)).toBe(0);
    expect(totalPages(21, 10)).toBe(3);
  });

  it("escapes LIKE wildcards in search text", () => {
    expect(containsPattern("abc")).toBe("%abc%");
    expect(containsPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
