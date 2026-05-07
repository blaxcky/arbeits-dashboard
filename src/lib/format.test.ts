import { describe, expect, it } from "vitest";
import { formatDays, formatWholeDays } from "./format";

describe("format helpers", () => {
  it("formats whole vacation days without decimals", () => {
    expect(formatWholeDays(1680)).toBe("4 Tage");
  });

  it("formats required consumption as days with one decimal", () => {
    expect(formatDays(1640)).toBe("3,4 Tage");
  });
});
