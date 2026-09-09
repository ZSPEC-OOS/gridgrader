const { test } = require("node:test");
const assert = require("node:assert/strict");
const { extractStudentNameFromHeaderText } = require("../src/shared/canvas-adapter.js");

test("extracts the name from Canvas's 'Results for <name> (<pronoun>)' template", () => {
  const raw =
    " Quiz 1: Ch19, 20, 21- Requires Respondus LockDown Browser Results for Kaitlyn Zatek (She/Her) ";
  assert.equal(extractStudentNameFromHeaderText(raw), "Kaitlyn Zatek");
});

test("handles a student with no pronoun set (no trailing parenthetical)", () => {
  const raw = "Quiz 1 Results for Jordan Lee";
  assert.equal(extractStudentNameFromHeaderText(raw), "Jordan Lee");
});

test("handles extra surrounding whitespace", () => {
  const raw = "   Some Quiz   Results for   Alex Kim   (they/them)   ";
  assert.equal(extractStudentNameFromHeaderText(raw), "Alex Kim");
});

test("returns null when the template phrase isn't present at all", () => {
  assert.equal(extractStudentNameFromHeaderText("Some unrelated header text"), null);
});
