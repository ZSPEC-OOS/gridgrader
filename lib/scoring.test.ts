import { describe, expect, it } from "vitest";
import { getAllowedScores, matchAllowedScore } from "./scoring";

describe("getAllowedScores", () => {
  it("keeps a decimal max all-or-nothing when the key does not specify partial credit", () => {
    expect(
      getAllowedScores("Correct answer identifies sodium chloride.", 1.5)
    ).toEqual([0, 1.5]);
  });

  it("allows explicitly specified component partial credit", () => {
    expect(
      getAllowedScores(
        "1 point for identifying the reagent. 0.5 points for explaining its purpose.",
        1.5
      )
    ).toEqual([0, 0.5, 1, 1.5]);
  });

  it("allows a single explicit partial-credit level without inventing others", () => {
    expect(
      getAllowedScores("Award 0.5 points for a partially correct answer.", 1.5)
    ).toEqual([0, 0.5, 1.5]);
  });

  it("does not treat vague partial-credit language as authorization for a numeric score", () => {
    expect(getAllowedScores("Partial credit is allowed when appropriate.", 1.5)).toEqual([
      0,
      1.5,
    ]);
  });

  it("supports repeated per-item point allocations", () => {
    expect(
      getAllowedScores("1 point for each of three required observations.", 3)
    ).toEqual([0, 1, 2, 3]);
  });

  it("supports an explicit half-credit directive", () => {
    expect(getAllowedScores("Half credit for the correct setup only.", 1.5)).toEqual([
      0,
      0.75,
      1.5,
    ]);
  });
});

describe("matchAllowedScore", () => {
  it("returns the canonical allowed value within floating-point tolerance", () => {
    expect(matchAllowedScore(0.5000001, [0, 0.5, 1.5])).toBe(0.5);
  });

  it("rejects a score that was not authorized", () => {
    expect(matchAllowedScore(0.75, [0, 0.5, 1.5])).toBeNull();
  });
});
