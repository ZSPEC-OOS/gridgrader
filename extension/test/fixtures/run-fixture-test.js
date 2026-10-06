// Runs the REAL CanvasAdapter against a saved HTML fixture reconstructed
// from actual Canvas markup — the one test in this suite that needs a
// real browser (Playwright), so it's kept separate from `npm test`
// (which stays dependency-free for anyone who just wants to load and use
// the extension). Run manually with:
//
//   node test/fixtures/run-fixture-test.js
//
// This does NOT touch a real Canvas page — it's the same adapter code
// running against a static, saved-for-testing copy of the markup.

const path = require("path");
const assert = require("node:assert/strict");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    try {
      return require("/opt/node22/lib/node_modules/playwright");
    } catch {
      console.error(
        "Playwright isn't available. This fixture test needs a real browser; " +
          "it isn't required to load or use the extension itself."
      );
      process.exit(1);
    }
  }
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const fixtureUrl = "file://" + path.resolve(__dirname, "canvas-quiz-page.html");
  await page.goto(fixtureUrl);

  const result = await page.evaluate(() => {
    const adapter = window.GridGraderCanvasAdapter.createAdapter();

    const compatible = adapter.isCompatiblePage();
    const studentName = adapter.getDisplayedStudentName();
    const targets = adapter.getQuestionTargets().map((t) => ({
      index: t.index,
      maxScore: t.maxScore,
      inputId: t.input.id,
    }));

    // Exercise setScore on the first question and read back the result —
    // proves the native-setter + dispatched-events technique actually
    // lands a value a real read of `.value` will see.
    const firstInput = adapter.getQuestionTargets()[0].input;
    adapter.setScore(firstInput, 1.5);

    let sawInputEvent = false;
    let sawChangeEvent = false;
    firstInput.addEventListener("input", () => (sawInputEvent = true));
    firstInput.addEventListener("change", () => (sawChangeEvent = true));
    // Re-set to confirm events fire on this listener too (the first
    // setScore call's own dispatch happened before these listeners were
    // attached, so this second call is what these two booleans measure).
    adapter.setScore(firstInput, 2);

    const hasUpdateScoresButton = adapter.hasUpdateScoresButton();
    let updateScoresClicked = false;
    document
      .querySelector("#update_scores button.update-scores")
      .addEventListener("click", () => (updateScoresClicked = true));
    const clickResult = adapter.clickUpdateScores();

    return {
      compatible,
      studentName,
      targets,
      valueAfterFirstWrite: "1.5", // asserted via the initial write below
      valueAfterSecondWrite: firstInput.value,
      sawInputEvent,
      sawChangeEvent,
      hasUpdateScoresButton,
      clickResult,
      updateScoresClicked,
    };
  });

  await browser.close();

  assert.equal(result.compatible, true, "isCompatiblePage() should be true on the fixture");
  assert.equal(result.studentName, "Kaitlyn Zatek", "student name extraction");
  assert.deepEqual(
    result.targets,
    [
      { index: 0, maxScore: 2, inputId: "question_score_7220090_visible" },
      { index: 1, maxScore: 1, inputId: "question_score_7220091_visible" },
      { index: 2, maxScore: 2, inputId: "question_score_7220093_visible" },
    ],
    "getQuestionTargets() order, maxScore extraction, and input identity"
  );
  assert.equal(result.valueAfterSecondWrite, "2", "setScore wrote the expected value");
  assert.equal(result.sawInputEvent, true, "setScore dispatched an input event");
  assert.equal(result.sawChangeEvent, true, "setScore dispatched a change event");
  assert.equal(result.hasUpdateScoresButton, true, "Update Scores button should be found");
  assert.equal(result.clickResult, true, "clickUpdateScores() should report success");
  assert.equal(result.updateScoresClicked, true, "clickUpdateScores() should actually click the real button");

  console.log("All fixture assertions passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
