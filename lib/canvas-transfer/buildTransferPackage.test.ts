import { describe, expect, it } from "vitest";
import { buildTransferPackage } from "./buildTransferPackage";

const questions = [
  { id: "q1", index: 0, header: "Define mitosis", maxScore: 10 },
  { id: "q2", index: 1, header: "Define meiosis", maxScore: 5 },
];

const students = [
  {
    id: "s1",
    name: "Alice",
    answers: [
      { id: "a1", questionId: "q1" },
      { id: "a2", questionId: "q2" },
    ],
  },
  {
    id: "s2",
    name: "Bob",
    answers: [
      { id: "a3", questionId: "q1" },
      { id: "a4", questionId: "q2" },
    ],
  },
];

describe("buildTransferPackage", () => {
  it("produces a package that passes its own validator", () => {
    const grades = { a1: { score: 8 }, a2: { score: 4 }, a3: { score: 0 }, a4: null };
    const pkg = buildTransferPackage({
      assignmentId: "asg1",
      assignmentName: "Bio 191 Quiz",
      questions,
      students,
      grades,
    });
    expect(pkg.assignment).toEqual({ id: "asg1", name: "Bio 191 Quiz" });
  });

  it("orders questions by index regardless of input array order", () => {
    const reordered = [questions[1], questions[0]]; // q2 (index 1) first
    const pkg = buildTransferPackage({
      assignmentId: "asg1",
      assignmentName: "Bio 191 Quiz",
      questions: reordered,
      students,
      grades: {},
    });
    expect(pkg.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(pkg.questions.map((q) => q.index)).toEqual([0, 1]);
  });

  it("pulls scores from the live grades map, not a stale default", () => {
    const grades = { a1: { score: 7 }, a2: { score: 2 }, a3: { score: 9 }, a4: { score: 3 } };
    const pkg = buildTransferPackage({
      assignmentId: "asg1",
      assignmentName: "Bio 191 Quiz",
      questions,
      students,
      grades,
    });
    const alice = pkg.students.find((s) => s.id === "s1")!;
    expect(alice.answers.find((a) => a.answerId === "a1")!.score).toBe(7);
    expect(alice.answers.find((a) => a.answerId === "a2")!.score).toBe(2);
  });

  it("maps a missing grade to a null score, not zero", () => {
    const pkg = buildTransferPackage({
      assignmentId: "asg1",
      assignmentName: "Bio 191 Quiz",
      questions,
      students,
      grades: { a1: { score: 8 } }, // a2, a3, a4 ungraded
    });
    const alice = pkg.students.find((s) => s.id === "s1")!;
    expect(alice.answers.find((a) => a.answerId === "a2")!.score).toBeNull();
  });

  it("stamps each answer with its question's questionIndex and maxScore", () => {
    const pkg = buildTransferPackage({
      assignmentId: "asg1",
      assignmentName: "Bio 191 Quiz",
      questions,
      students,
      grades: {},
    });
    const alice = pkg.students.find((s) => s.id === "s1")!;
    const q2Answer = alice.answers.find((a) => a.answerId === "a2")!;
    expect(q2Answer.questionIndex).toBe(1);
    expect(q2Answer.maxScore).toBe(5);
  });

  it("throws if an answer references a question not in the questions array", () => {
    const badStudents = [
      { id: "s1", name: "Alice", answers: [{ id: "a1", questionId: "does-not-exist" }] },
    ];
    expect(() =>
      buildTransferPackage({
        assignmentId: "asg1",
        assignmentName: "Bio 191 Quiz",
        questions,
        students: badStudents,
        grades: {},
      })
    ).toThrow(/unknown question/i);
  });

  it("produces a deterministic exportedAt when one is supplied", () => {
    const fixed = new Date("2026-01-01T00:00:00.000Z");
    const pkg = buildTransferPackage({
      assignmentId: "asg1",
      assignmentName: "Bio 191 Quiz",
      questions,
      students,
      grades: {},
      now: fixed,
    });
    expect(pkg.exportedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
