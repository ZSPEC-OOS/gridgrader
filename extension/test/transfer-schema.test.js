const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateCanvasTransferPackage,
  packageHasIncompleteScores,
  createCanvasExportMessage,
} = require("../src/shared/transfer-schema.js");

function basePackage() {
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

test("accepts a well-formed V1 package", () => {
  assert.doesNotThrow(() => validateCanvasTransferPackage(basePackage()));
});

test("accepts a fractional score (generic transport, not the app's entry policy)", () => {
  const pkg = basePackage();
  pkg.students[0].answers[1].score = 1.5;
  assert.doesNotThrow(() => validateCanvasTransferPackage(pkg));
});

test("rejects an unknown/future version rather than guessing", () => {
  const pkg = { ...basePackage(), version: 2 };
  assert.throws(() => validateCanvasTransferPackage(pkg), /version/i);
});

test("rejects a malformed package (not an object)", () => {
  assert.throws(() => validateCanvasTransferPackage("nope"), /object/i);
  assert.throws(() => validateCanvasTransferPackage(null), /object/i);
});

test("rejects a duplicate student id", () => {
  const pkg = basePackage();
  pkg.students[1].id = pkg.students[0].id;
  assert.throws(() => validateCanvasTransferPackage(pkg), /duplicate student/i);
});

test("rejects a duplicate question id", () => {
  const pkg = basePackage();
  pkg.questions[1].id = pkg.questions[0].id;
  assert.throws(() => validateCanvasTransferPackage(pkg), /duplicate question/i);
});

test("rejects a duplicate answer id", () => {
  const pkg = basePackage();
  pkg.students[0].answers[1].answerId = pkg.students[0].answers[0].answerId;
  assert.throws(() => validateCanvasTransferPackage(pkg), /duplicate answer/i);
});

test("rejects a score above maxScore", () => {
  const pkg = basePackage();
  pkg.students[0].answers[0].score = 999;
  assert.throws(() => validateCanvasTransferPackage(pkg), /score/i);
});

test("rejects a negative score", () => {
  const pkg = basePackage();
  pkg.students[0].answers[0].score = -1;
  assert.throws(() => validateCanvasTransferPackage(pkg), /score/i);
});

test("accepts a null score", () => {
  assert.doesNotThrow(() => validateCanvasTransferPackage(basePackage()));
});

test("detects incomplete packages via packageHasIncompleteScores", () => {
  const pkg = validateCanvasTransferPackage(basePackage());
  assert.equal(packageHasIncompleteScores(pkg), true);

  const complete = basePackage();
  complete.students[1].answers[1].score = 2;
  assert.equal(packageHasIncompleteScores(validateCanvasTransferPackage(complete)), false);
});

test("createCanvasExportMessage has the exact envelope the receiver expects", () => {
  const pkg = validateCanvasTransferPackage(basePackage());
  const message = createCanvasExportMessage(pkg);
  assert.equal(message.source, "gridgrader-web");
  assert.equal(message.type, "GRIDGRADER_CANVAS_EXPORT");
  assert.equal(message.payload.schema, "gridgrader.canvas-transfer");
  assert.equal(message.payload.version, 1);
});
