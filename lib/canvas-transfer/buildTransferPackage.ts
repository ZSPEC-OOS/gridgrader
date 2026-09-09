import {
  validateCanvasTransferPackage,
  type CanvasTransferPackageV1,
} from "./schema";

export type BuildTransferPackageInput = {
  assignmentId: string;
  assignmentName: string;
  questions: Array<{
    id: string;
    index: number;
    header: string;
    maxScore: number;
  }>;
  students: Array<{
    id: string;
    name: string;
    answers: Array<{ id: string; questionId: string }>;
  }>;
  // Live scores, keyed by answer id — the grid's current in-memory state,
  // not necessarily what was last persisted, so a regrade or manual edit
  // made moments ago is reflected in the export.
  grades: Record<string, { score: number } | null | undefined>;
  now?: Date;
};

// Converts the grid's current in-memory data into a CanvasTransferPackageV1
// and validates the result before returning it — the package this produces
// is guaranteed to pass validateCanvasTransferPackage, so a caller never
// has to separately re-check what this function hands back.
export function buildTransferPackage(
  input: BuildTransferPackageInput
): CanvasTransferPackageV1 {
  const { assignmentId, assignmentName, questions, students, grades } = input;
  const now = input.now ?? new Date();

  const maxScoreByQuestionId = new Map(questions.map((q) => [q.id, q.maxScore]));
  const indexByQuestionId = new Map(questions.map((q) => [q.id, q.index]));

  const pkg: CanvasTransferPackageV1 = {
    schema: "gridgrader.canvas-transfer",
    version: 1,
    exportedAt: now.toISOString(),
    assignment: {
      id: assignmentId,
      name: assignmentName,
    },
    questions: questions
      .map((q) => ({
        id: q.id,
        index: q.index,
        header: q.header,
        maxScore: q.maxScore,
      }))
      .sort((a, b) => a.index - b.index),
    students: students.map((student) => ({
      id: student.id,
      name: student.name,
      answers: student.answers.map((answer) => {
        const grade = grades[answer.id];
        const maxScore = maxScoreByQuestionId.get(answer.questionId);
        const questionIndex = indexByQuestionId.get(answer.questionId);

        if (maxScore === undefined || questionIndex === undefined) {
          throw new Error(
            `Answer ${answer.id} references unknown question ${answer.questionId}.`
          );
        }

        return {
          answerId: answer.id,
          questionId: answer.questionId,
          questionIndex,
          score: grade?.score ?? null,
          maxScore,
        };
      }),
    })),
  };

  // Re-validate what we just built rather than trusting the assembly logic
  // above — this is the same check the extension will run on receipt, so
  // GridGrader never emits a package it wouldn't accept itself.
  return validateCanvasTransferPackage(pkg);
}
