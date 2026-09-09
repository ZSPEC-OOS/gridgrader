import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRADING_STRICTNESS_LEVEL,
  GRADING_STRICTNESS_LEVEL_VALUES,
  GRADING_STRICTNESS_LEVELS,
  getStrictnessGuidance,
  getStrictnessLabel,
  isGradingStrictnessLevel,
  resolveGradingStrictnessLevel,
} from "./gradingStrictness";

describe("configuration", () => {
  it("defaults to level 3 (Balanced)", () => {
    expect(DEFAULT_GRADING_STRICTNESS_LEVEL).toBe(3);
    expect(GRADING_STRICTNESS_LEVELS[3].label).toBe("Balanced");
  });

  it("has exactly the five documented levels, in order", () => {
    expect(GRADING_STRICTNESS_LEVEL_VALUES).toEqual([1, 2, 3, 4, 5]);
    expect(Object.keys(GRADING_STRICTNESS_LEVELS).map(Number).sort()).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("labels each level as specified", () => {
    expect(getStrictnessLabel(1)).toBe("Very Lenient");
    expect(getStrictnessLabel(2)).toBe("Lenient");
    expect(getStrictnessLabel(3)).toBe("Balanced");
    expect(getStrictnessLabel(4)).toBe("Strict");
    expect(getStrictnessLabel(5)).toBe("Very Strict");
  });
});

describe("validation", () => {
  it("accepts every integer 1..5", () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(isGradingStrictnessLevel(level)).toBe(true);
      expect(resolveGradingStrictnessLevel(level)).toBe(level);
    }
  });

  it("rejects 0 and falls back to the default", () => {
    expect(isGradingStrictnessLevel(0)).toBe(false);
    expect(resolveGradingStrictnessLevel(0)).toBe(DEFAULT_GRADING_STRICTNESS_LEVEL);
  });

  it("rejects 6 and falls back to the default", () => {
    expect(isGradingStrictnessLevel(6)).toBe(false);
    expect(resolveGradingStrictnessLevel(6)).toBe(DEFAULT_GRADING_STRICTNESS_LEVEL);
  });

  it("rejects fractional levels like 2.5 and falls back to the default", () => {
    expect(isGradingStrictnessLevel(2.5)).toBe(false);
    expect(resolveGradingStrictnessLevel(2.5)).toBe(DEFAULT_GRADING_STRICTNESS_LEVEL);
  });

  it("rejects non-numeric input and falls back to the default", () => {
    expect(isGradingStrictnessLevel("3")).toBe(false);
    expect(isGradingStrictnessLevel(null)).toBe(false);
    expect(isGradingStrictnessLevel(undefined)).toBe(false);
    expect(resolveGradingStrictnessLevel(undefined)).toBe(
      DEFAULT_GRADING_STRICTNESS_LEVEL
    );
  });
});

describe("prompt construction", () => {
  it("produces materially different guidance for level 1 and level 5", () => {
    const lenient = getStrictnessGuidance(1);
    const strict = getStrictnessGuidance(5);

    expect(lenient).not.toBe(strict);
    expect(lenient.toLowerCase()).toContain("leniently");
    expect(strict.toLowerCase()).toContain("literally");
  });

  it("never lets an invalid level reach prompt construction", () => {
    // @ts-expect-error deliberately passing an out-of-range value
    const guidance = getStrictnessGuidance(99);
    expect(guidance).toBe(GRADING_STRICTNESS_LEVELS[DEFAULT_GRADING_STRICTNESS_LEVEL].prompt);
  });
});
