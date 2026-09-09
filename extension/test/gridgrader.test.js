const { test } = require("node:test");
const assert = require("node:assert/strict");
const { shouldAcceptMessage, handleIncomingPackage } = require("../src/content/gridgrader.js");
const schema = require("../src/shared/transfer-schema.js");

const validMessage = {
  source: "gridgrader-web",
  type: "GRIDGRADER_CANVAS_EXPORT",
  payload: {},
};

test("accepts a same-window, same-origin, correctly-typed message", () => {
  assert.equal(
    shouldAcceptMessage({
      isSelfWindow: true,
      origin: "https://gridgrader.example",
      expectedOrigin: "https://gridgrader.example",
      data: validMessage,
    }),
    true
  );
});

test("rejects a message not from the window itself (e.g. an iframe)", () => {
  assert.equal(
    shouldAcceptMessage({
      isSelfWindow: false,
      origin: "https://gridgrader.example",
      expectedOrigin: "https://gridgrader.example",
      data: validMessage,
    }),
    false
  );
});

test("rejects a message from a different origin", () => {
  assert.equal(
    shouldAcceptMessage({
      isSelfWindow: true,
      origin: "https://evil.example",
      expectedOrigin: "https://gridgrader.example",
      data: validMessage,
    }),
    false
  );
});

test("rejects a message with the wrong source string", () => {
  assert.equal(
    shouldAcceptMessage({
      isSelfWindow: true,
      origin: "https://gridgrader.example",
      expectedOrigin: "https://gridgrader.example",
      data: { ...validMessage, source: "some-other-page" },
    }),
    false
  );
});

test("rejects a message with the wrong type string", () => {
  assert.equal(
    shouldAcceptMessage({
      isSelfWindow: true,
      origin: "https://gridgrader.example",
      expectedOrigin: "https://gridgrader.example",
      data: { ...validMessage, type: "SOMETHING_ELSE" },
    }),
    false
  );
});

test("rejects missing/malformed data", () => {
  assert.equal(
    shouldAcceptMessage({
      isSelfWindow: true,
      origin: "https://gridgrader.example",
      expectedOrigin: "https://gridgrader.example",
      data: null,
    }),
    false
  );
  assert.equal(
    shouldAcceptMessage({
      isSelfWindow: true,
      origin: "https://gridgrader.example",
      expectedOrigin: "https://gridgrader.example",
      data: "not an object",
    }),
    false
  );
});

test("handleIncomingPackage stores a valid payload", () => {
  const payload = {
    schema: "gridgrader.canvas-transfer",
    version: 1,
    exportedAt: new Date().toISOString(),
    assignment: { id: "a1", name: "Test" },
    questions: [{ id: "q1", index: 0, header: "Q1", maxScore: 10 }],
    students: [
      {
        id: "s1",
        name: "Alice",
        answers: [{ answerId: "a1", questionId: "q1", questionIndex: 0, score: 5, maxScore: 10 }],
      },
    ],
  };
  const result = handleIncomingPackage(payload, schema);
  assert.equal(result.ok, true);
  assert.equal(result.pkg.assignment.id, "a1");
});

test("handleIncomingPackage rejects an invalid payload without throwing", () => {
  const result = handleIncomingPackage({ schema: "wrong" }, schema);
  assert.equal(result.ok, false);
  assert.match(result.error, /schema/i);
});
