import { describe, expect, it } from "vitest";
import { formatDateKey, isValidDateKey } from "./dates";

describe("date helpers", () => {
  it("detects valid ISO date keys", () => {
    expect(isValidDateKey("2026-05-18")).toBe(true);
    expect(isValidDateKey("")).toBe(false);
    expect(isValidDateKey("2026-02-30")).toBe(false);
  });

  it("formats missing or invalid date keys without throwing", () => {
    expect(formatDateKey("")).toBe("-");
    expect(formatDateKey("2026-02-30")).toBe("-");
  });
});
