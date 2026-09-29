import { describe, it, expect } from "vitest";
import { shouldFallbackToDemoData } from "./syncDecision";

describe("shouldFallbackToDemoData", () => {
  it("falls back to demo data for a GET (reads may show cached data)", () => {
    expect(shouldFallbackToDemoData("GET")).toBe(true);
    expect(shouldFallbackToDemoData(undefined)).toBe(true); // apiRequest defaults to GET
  });

  it("does NOT fall back for a write — must let the error propagate so the caller can queue it (Finding 3/4)", () => {
    expect(shouldFallbackToDemoData("POST")).toBe(false);
    expect(shouldFallbackToDemoData("PUT")).toBe(false);
    expect(shouldFallbackToDemoData("PATCH")).toBe(false);
    expect(shouldFallbackToDemoData("DELETE")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(shouldFallbackToDemoData("post")).toBe(false);
    expect(shouldFallbackToDemoData("get")).toBe(true);
  });
});
