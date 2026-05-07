import { describe, expect, it } from "vitest";
import { normalizeTimeInput } from "./App";

describe("normalizeTimeInput", () => {
  it("treats one and two digit values as full hours", () => {
    expect(normalizeTimeInput("7")).toBe("07:00");
    expect(normalizeTimeInput("17")).toBe("17:00");
  });

  it("keeps existing compact and colon formats valid", () => {
    expect(normalizeTimeInput("730")).toBe("07:30");
    expect(normalizeTimeInput("0730")).toBe("07:30");
    expect(normalizeTimeInput("7:30")).toBe("07:30");
  });

  it("rejects invalid time values", () => {
    expect(normalizeTimeInput("24")).toBeNull();
    expect(normalizeTimeInput("1760")).toBeNull();
    expect(normalizeTimeInput("abc")).toBeNull();
  });
});
