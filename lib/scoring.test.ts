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

  it("does not infer a numeric amount from half-credit language", () => {
    expect(getAllowedScores("Half credit for the correct setup only.", 1.5)).toEqual([
      0,
      1.5,
    ]);
  });
});

describe("matchAllowedScore", () => {
  it("returns the canonical allowed value within floating-point tolerance", () => {
    expect(matchAllowedScore(0.1 + 0.2, [0, 0.3, 1.5])).toBe(0.3);
  });

  it("rejects a score that was not authorized", () => {
    expect(matchAllowedScore(0.75, [0, 0.5, 1.5])).toBeNull();
  });
});

describe("conservative rubric parsing", () => {
  it.each([
    "Do not award 0.5 points for X.",
    "Never give 0.5 points for X.",
    "Deduct 0.5 points for X.",
    "-0.5 points for X.",
    "The answer is 0.5 points for X.",
    'Example: "0.5 points for X".',
    "Half credit allowed.",
    "0.5 points for X is not permitted.",
    "Partial credit allowed.",
  ])("does not authorize credit from %s", (criteria) => {
    expect(getAllowedScores(criteria, 1.5)).toEqual([0, 1.5]);
  });

  it("does not add alternative levels", () => {
    expect(getAllowedScores("0.4 points if X; 0.6 points when Y.", 1.5))
      .toEqual([0, 0.4, 0.6, 1.5]);
    expect(getAllowedScores("0.4 points for X; or 0.6 points for Y.", 1.5))
      .not.toContain(1);
  });

  it("counts repeated components only as many times as specified", () => {
    expect(getAllowedScores("0.5 points for each of two observations; 0.2 points for Y.", 2))
      .toEqual([0, 0.2, 0.5, 0.7, 1, 1.2, 2]);
  });

  it("does not invent repeated amounts for an unspecified count", () => {
    expect(getAllowedScores("0.5 points per item.", 2)).toEqual([0, 0.5, 2]);
  });

  it("bounds excessive repetitions and subset sums", () => {
    expect(getAllowedScores("0.000001 points for each of 100000000 items.", 100))
      .toEqual([0, 100]);
    const criteria = Array.from({ length: 20 }, (_, i) => `${2 ** i} points for component ${i}`).join("; ");
    expect(getAllowedScores(criteria, 2000000)).toEqual([0, 2000000]);
  });

  it("preserves small maxima and numeric literals without six-digit rounding", () => {
    expect(getAllowedScores("generic key", 0.0000001)).toEqual([0, 0.0000001]);
    expect(getAllowedScores("0.123456789 points for X", 1.5)).toEqual([0, 0.123456789, 1.5]);
  });

  it("does not round nearby unauthorized scores", () => {
    expect(matchAllowedScore(0.5000001, [0, 0.5, 1.5])).toBeNull();
    expect(matchAllowedScore(0.0000001, [0, 1.5])).toBeNull();
    expect(matchAllowedScore(-0.0000001, [0, 1.5])).toBeNull();
  });
});


it("honors explicit all-or-nothing restrictions over numeric component prose", () => {
  expect(getAllowedScores("No partial credit. 1 point for X; 0.5 points for Y.", 1.5)).toEqual([0, 1.5]);
  expect(getAllowedScores("Do not award partial credit. 0.5 points for X.", 1.5)).toEqual([0, 1.5]);
});
it("does not count duplicate components as separate allocations", () => {
  expect(getAllowedScores("0.5 points for X; 0.5 points for X", 2)).toEqual([0, 0.5, 2]);
});

it("does not infer repetition counts from incidental numbers in the criterion", () => {
  expect(getAllowedScores("0.5 points per correct identification of isotope 12", 2)).toEqual([0, 0.5, 2]);
  expect(getAllowedScores("0.5 points for each of 1.5 observations", 2)).toEqual([0, 0.5, 2]);
});
