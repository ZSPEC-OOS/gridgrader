// Runs the REAL CanvasNavigator against a saved HTML fixture of the
// top-frame student-navigation controls — a different document from
// canvas-quiz-page.html (see canvas-navigator.js). Kept separate from
// `npm test` for the same reason as run-fixture-test.js.
//
//   node test/fixtures/run-navigator-fixture-test.js

const path = require("path");
const assert = require("node:assert/strict");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    try {
      return require("/opt/node22/lib/node_modules/playwright");
    } catch {
      console.error("Playwright isn't available. Not required to load or use the extension itself.");
      process.exit(1);
    }
  }
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const fixtureUrl = "file://" + path.resolve(__dirname, "canvas-nav-page.html");
  await page.goto(fixtureUrl);

  const result = await page.evaluate(() => {
    const navigator_ = window.GridGraderCanvasNavigator.createNavigator();

    let nextClicked = false;
    let prevClicked = false;
    document.getElementById("next-student-button").addEventListener("click", () => (nextClicked = true));
    document.getElementById("prev-student-button").addEventListener("click", () => (prevClicked = true));

    const isAvailable = navigator_.isAvailable();
    const canGoNext = navigator_.canGoNext();
    const canGoPrev = navigator_.canGoPrev();
    const clickNextResult = navigator_.clickNext();

    return { isAvailable, canGoNext, canGoPrev, clickNextResult, nextClicked, prevClickedBeforePrevCall: prevClicked };
  });

  await browser.close();

  assert.equal(result.isAvailable, true, "isAvailable() should be true on the fixture");
  assert.equal(result.canGoNext, true, "canGoNext() should be true (button present, not disabled)");
  assert.equal(result.canGoPrev, true, "canGoPrev() should be true (button present, not disabled)");
  assert.equal(result.clickNextResult, true, "clickNext() should report success");
  assert.equal(result.nextClicked, true, "clickNext() should actually click the real next button");
  assert.equal(result.prevClickedBeforePrevCall, false, "clickNext() should not also click prev");

  console.log("All navigator fixture assertions passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
