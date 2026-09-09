const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NotImplementedCanvasNavigator } = require("../src/shared/canvas-navigator.js");

test("NotImplementedCanvasNavigator refuses everything (used before any real check)", () => {
  const nav = new NotImplementedCanvasNavigator();
  assert.equal(nav.isAvailable(), false);
  assert.equal(nav.canGoNext(), false);
  assert.equal(nav.canGoPrev(), false);
  assert.equal(nav.clickNext(), false);
  assert.equal(nav.clickPrev(), false);
});

// RealCanvasNavigator itself needs a real `document` (the next/prev
// buttons in an actual page) — covered in test/fixtures/run-fixture-test.js
// against the saved HTML fixture, not here.
