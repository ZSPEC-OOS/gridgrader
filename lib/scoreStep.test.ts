import { describe, expect, it } from "vitest";
import { isAllowedScore, resolveScoreStep, roundToStep } from "./scoreStep";

describe("resolveScoreStep", () => {
  it("accepts only 1, 0.5 and 0.25", () => {
    expect(resolveScoreStep(0.25)).toBe(0.25);
    expect(resolveScoreStep(0.5)).toBe(0.5);
    expect(resolveScoreStep(0.3)).toBe(1);
    expect(resolveScoreStep(undefined)).toBe(1);
  });
});

describe("roundToStep", () => {
  it("snaps to the nearest increment and clamps", () => {
    expect(roundToStep(1.2, 2, 0.5)).toBe(1);
    expect(roundToStep(1.3, 2, 0.5)).toBe(1.5);
    expect(roundToStep(0.6, 2, 0.25)).toBe(0.5);
    expect(roundToStep(-3, 2, 0.5)).toBe(0);
    expect(roundToStep(9, 2, 0.5)).toBe(2);
  });
  it("keeps a maximum that is not a multiple of the step", () => {
    expect(roundToStep(1.5, 1.5, 1)).toBe(1.5);
    expect(roundToStep(1.4, 1.5, 1)).toBe(1);
  });
});

describe("isAllowedScore", () => {
  it("allows multiples of the step or the maximum only", () => {
    expect(isAllowedScore(0.5, 1.5, 0.5)).toBe(true);
    expect(isAllowedScore(0.75, 1.5, 0.5)).toBe(false);
    expect(isAllowedScore(1.5, 1.5, 1)).toBe(true);
    expect(isAllowedScore(0.5, 1.5, 1)).toBe(false);
    expect(isAllowedScore(2, 1.5, 0.5)).toBe(false);
  });
});
