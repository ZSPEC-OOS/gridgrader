import { describe, expect, it } from "vitest";
import {
  CanvasTransferValidationError,
  countScoredAnswers,
  packageHasIncompleteScores,
  validateCanvasTransferPackage,
  type CanvasTransferPackageV1,
} from "./schema";

function basePackage(): CanvasTransferPackageV1 {
  return {
    schema: "gridgrader.canvas-transfer",
    version: 1,
    exportedAt: new Date().toISOString(),
    assignment: { id: "a1", name: "Bio 191 Quiz" },
    questions: [
      { id: "q1", index: 0, header: "Q1", maxScore: 10 },
      { id: "q2", index: 1, header: "Q2", maxScore: 2 },
    ],
    students: [
      {
        id: "s1",
        name: "Alice",
        answers: [
          { answerId: "a-s1-q1", questionId: "q1", questionIndex: 0, score: 8, maxScore: 10 },
          { answerId: "a-s1-q2", questionId: "q2", questionIndex: 1, score: 1.5, maxScore: 2 },
        ],
      },
      {
        id: "s2",
        name: "Bob",
        answers: [
          { answerId: "a-s2-q1", questionId: "q1", questionIndex: 0, score: 0, maxScore: 10 },
          { answerId: "a-s2-q2", questionId: "q2", questionIndex: 1, score: null, maxScore: 2 },
        ],
      },
    ],
  };
}

describe("validateCanvasTransferPackage — valid cases", () => {
  it("accepts a well-formed package", () => {
    expect(() => validateCanvasTransferPackage(basePackage())).not.toThrow();
  });

  it("accepts an integer score", () => {
    const pkg = basePackage();
    pkg.students[0].answers[0].score = 8;
    expect(() => validateCanvasTransferPackage(pkg)).not.toThrow();
  });

  it("accepts a fractional score (the transport schema is generic; whole-number policy is enforced at entry, not in transit)", () => {
    const pkg = basePackage();
    pkg.students[0].answers[1].score = 1.5;
    expect(() => validateCanvasTransferPackage(pkg)).not.toThrow();
  });

  it("accepts a zero score", () => {
    const pkg = basePackage();
    pkg.students[1].answers[0].score = 0;
    expect(() => validateCanvasTransferPackage(pkg)).not.toThrow();
  });

  it("accepts a score exactly equal to maxScore", () => {
    const pkg = basePackage();
    pkg.students[0].answers[0].score = 10;
    expect(() => validateCanvasTransferPackage(pkg)).not.toThrow();
  });

  it("accepts a null score", () => {
    const pkg = basePackage();
    pkg.students[1].answers[1].score = null;
    expect(() => validateCanvasTransferPackage(pkg)).not.toThrow();
  });
});

describe("validateCanvasTransferPackage — invalid cases", () => {
  it("rejects an unrecognized schema string", () => {
    const pkg = { ...basePackage(), schema: "something-else" };
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(CanvasTransferValidationError);
  });

  it("rejects an unsupported version rather than guessing", () => {
    const pkg = { ...basePackage(), version: 2 };
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(/version/i);
  });

  it("rejects a score above maxScore", () => {
    const pkg = basePackage();
    pkg.students[0].answers[0].score = 11;
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(/score/i);
  });

  it("rejects a negative score", () => {
    const pkg = basePackage();
    pkg.students[0].answers[0].score = -1;
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(/score/i);
  });

  it("rejects a duplicate student id", () => {
    const pkg = basePackage();
    pkg.students[1].id = pkg.students[0].id;
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(/duplicate student/i);
  });

  it("rejects a duplicate question id", () => {
    const pkg = basePackage();
    pkg.questions[1].id = pkg.questions[0].id;
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(/duplicate question/i);
  });

  it("rejects a duplicate answer id", () => {
    const pkg = basePackage();
    pkg.students[0].answers[1].answerId = pkg.students[0].answers[0].answerId;
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(/duplicate answer/i);
  });

  it("rejects non-contiguous question indices", () => {
    const pkg = basePackage();
    pkg.questions[1].index = 5;
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(/contiguous/i);
  });

  it("rejects an answer referencing an unknown question", () => {
    const pkg = basePackage();
    pkg.students[0].answers[0].questionId = "does-not-exist";
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(/known question/i);
  });

  it("rejects an answer whose questionIndex doesn't match its question", () => {
    const pkg = basePackage();
    pkg.students[0].answers[0].questionIndex = 99;
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(/questionIndex/i);
  });

  it("rejects an answer whose maxScore doesn't match its question's maxScore", () => {
    const pkg = basePackage();
    pkg.students[0].answers[0].maxScore = 999;
    expect(() => validateCanvasTransferPackage(pkg)).toThrow(/maxScore/i);
  });
});

describe("packageHasIncompleteScores / countScoredAnswers", () => {
  it("detects an incomplete package", () => {
    const pkg = validateCanvasTransferPackage(basePackage());
    expect(packageHasIncompleteScores(pkg)).toBe(true);
  });

  it("reports a complete package as complete", () => {
    const pkg = basePackage();
    pkg.students[1].answers[1].score = 2;
    expect(packageHasIncompleteScores(validateCanvasTransferPackage(pkg))).toBe(false);
  });

  it("counts only non-null scores", () => {
    const pkg = validateCanvasTransferPackage(basePackage());
    // 4 answers total, 1 is null (s2/q2)
    expect(countScoredAnswers(pkg)).toBe(3);
  });
});
