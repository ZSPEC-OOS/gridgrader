// Versioned data contract for handing a graded assignment off to the
// companion Canvas browser extension. This file has zero external
// dependencies (no Next.js/Prisma imports) so it can be copied verbatim
// into the extension's own `shared/transfer-schema.ts` — the extension
// must validate against the exact same contract, not a re-derived one.

export type CanvasTransferQuestion = {
  id: string;
  index: number; // zero-based canonical order
  header: string;
  maxScore: number;
};

export type CanvasTransferAnswer = {
  answerId: string;
  questionId: string;
  questionIndex: number;
  score: number | null;
  maxScore: number;
};

export type CanvasTransferStudent = {
  id: string;
  name: string;
  answers: CanvasTransferAnswer[];
};

export type CanvasTransferPackageV1 = {
  schema: "gridgrader.canvas-transfer";
  version: 1;
  exportedAt: string; // ISO-8601
  assignment: {
    id: string;
    name: string;
  };
  questions: CanvasTransferQuestion[];
  students: CanvasTransferStudent[];
};

export class CanvasTransferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasTransferValidationError";
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// Throws CanvasTransferValidationError on the first problem found, with a
// message specific enough to act on. Returns the input, narrowed to
// CanvasTransferPackageV1, on success.
export function validateCanvasTransferPackage(
  pkg: unknown
): CanvasTransferPackageV1 {
  if (typeof pkg !== "object" || pkg === null) {
    throw new CanvasTransferValidationError("Transfer package is not an object.");
  }
  const p = pkg as Record<string, unknown>;

  if (p.schema !== "gridgrader.canvas-transfer") {
    throw new CanvasTransferValidationError(
      `Unrecognized schema: ${JSON.stringify(p.schema)}.`
    );
  }
  if (p.version !== 1) {
    throw new CanvasTransferValidationError(
      `Unsupported package version: ${JSON.stringify(p.version)}. Only version 1 is supported.`
    );
  }
  if (!isNonEmptyString(p.exportedAt) || Number.isNaN(Date.parse(p.exportedAt))) {
    throw new CanvasTransferValidationError("exportedAt must be a valid ISO-8601 timestamp.");
  }

  const assignment = p.assignment as Record<string, unknown> | undefined;
  if (
    typeof assignment !== "object" ||
    assignment === null ||
    !isNonEmptyString(assignment.id) ||
    !isNonEmptyString(assignment.name)
  ) {
    throw new CanvasTransferValidationError("assignment.id and assignment.name are required.");
  }

  if (!Array.isArray(p.questions) || p.questions.length === 0) {
    throw new CanvasTransferValidationError("questions must be a non-empty array.");
  }

  const questionIds = new Set<string>();
  const questionIndices = new Set<number>();
  const maxScoreByQuestionId = new Map<string, number>();
  const indexByQuestionId = new Map<string, number>();

  for (const [i, raw] of p.questions.entries()) {
    const q = raw as Record<string, unknown>;
    if (!isNonEmptyString(q.id)) {
      throw new CanvasTransferValidationError(`questions[${i}].id must be a non-empty string.`);
    }
    if (questionIds.has(q.id)) {
      throw new CanvasTransferValidationError(`Duplicate question id: ${q.id}.`);
    }
    questionIds.add(q.id);

    if (!Number.isInteger(q.index) || (q.index as number) < 0) {
      throw new CanvasTransferValidationError(
        `questions[${i}].index must be a non-negative integer.`
      );
    }
    if (questionIndices.has(q.index as number)) {
      throw new CanvasTransferValidationError(`Duplicate question index: ${q.index}.`);
    }
    questionIndices.add(q.index as number);

    if (!isNonEmptyString(q.header)) {
      throw new CanvasTransferValidationError(`questions[${i}].header must be a non-empty string.`);
    }
    if (!isFiniteNumber(q.maxScore) || (q.maxScore as number) < 0) {
      throw new CanvasTransferValidationError(
        `questions[${i}].maxScore must be a finite number >= 0.`
      );
    }

    maxScoreByQuestionId.set(q.id, q.maxScore as number);
    indexByQuestionId.set(q.id, q.index as number);
  }

  // Indices must be contiguous 0..N-1 — the extension maps by canonical
  // order, so a gap or duplicate would silently misalign question mapping.
  const sortedIndices = Array.from(questionIndices).sort((a, b) => a - b);
  for (let i = 0; i < sortedIndices.length; i++) {
    if (sortedIndices[i] !== i) {
      throw new CanvasTransferValidationError(
        "Question indices must be contiguous starting at 0."
      );
    }
  }

  if (!Array.isArray(p.students) || p.students.length === 0) {
    throw new CanvasTransferValidationError("students must be a non-empty array.");
  }

  const studentIds = new Set<string>();
  const answerIds = new Set<string>();

  for (const [si, rawStudent] of p.students.entries()) {
    const s = rawStudent as Record<string, unknown>;
    if (!isNonEmptyString(s.id)) {
      throw new CanvasTransferValidationError(`students[${si}].id must be a non-empty string.`);
    }
    if (studentIds.has(s.id)) {
      throw new CanvasTransferValidationError(`Duplicate student id: ${s.id}.`);
    }
    studentIds.add(s.id);

    if (!isNonEmptyString(s.name)) {
      throw new CanvasTransferValidationError(`students[${si}].name must be a non-empty string.`);
    }

    if (!Array.isArray(s.answers)) {
      throw new CanvasTransferValidationError(`students[${si}].answers must be an array.`);
    }

    for (const [ai, rawAnswer] of s.answers.entries()) {
      const a = rawAnswer as Record<string, unknown>;
      const where = `students[${si}].answers[${ai}]`;

      if (!isNonEmptyString(a.answerId)) {
        throw new CanvasTransferValidationError(`${where}.answerId must be a non-empty string.`);
      }
      if (answerIds.has(a.answerId)) {
        throw new CanvasTransferValidationError(`Duplicate answer id: ${a.answerId}.`);
      }
      answerIds.add(a.answerId);

      if (!isNonEmptyString(a.questionId) || !maxScoreByQuestionId.has(a.questionId)) {
        throw new CanvasTransferValidationError(
          `${where}.questionId does not reference a known question.`
        );
      }

      const expectedIndex = indexByQuestionId.get(a.questionId);
      if (a.questionIndex !== expectedIndex) {
        throw new CanvasTransferValidationError(
          `${where}.questionIndex (${a.questionIndex}) does not match question ${a.questionId}'s index (${expectedIndex}).`
        );
      }

      const questionMaxScore = maxScoreByQuestionId.get(a.questionId)!;
      if (!isFiniteNumber(a.maxScore) || a.maxScore !== questionMaxScore) {
        throw new CanvasTransferValidationError(
          `${where}.maxScore (${a.maxScore}) does not match question ${a.questionId}'s maxScore (${questionMaxScore}).`
        );
      }

      if (a.score !== null) {
        if (!isFiniteNumber(a.score) || (a.score as number) < 0 || (a.score as number) > questionMaxScore) {
          throw new CanvasTransferValidationError(
            `${where}.score (${a.score}) must be null or a finite number between 0 and ${questionMaxScore}.`
          );
        }
      }
    }
  }

  return p as unknown as CanvasTransferPackageV1;
}

export function packageHasIncompleteScores(pkg: CanvasTransferPackageV1): boolean {
  return pkg.students.some((s) => s.answers.some((a) => a.score === null));
}

export function countScoredAnswers(pkg: CanvasTransferPackageV1): number {
  return pkg.students.reduce(
    (sum, s) => sum + s.answers.filter((a) => a.score !== null).length,
    0
  );
}
