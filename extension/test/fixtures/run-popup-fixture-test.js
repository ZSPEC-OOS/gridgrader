// Exercises the real popup.html/popup.js against a mocked chrome.* API
// in a real browser (Playwright) — the popup has real DOM/event logic
// (rendering, dropdown filtering, the 600ms navigate-then-refresh flow)
// that a pure-function unit test can't cover. Kept separate from
// `npm test` for the same reason as the other fixture test: loading and
// using the extension itself stays dependency-free.
//
//   node test/fixtures/run-popup-fixture-test.js

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

const testPackage = {
  schema: "gridgrader.canvas-transfer",
  version: 1,
  exportedAt: "2026-01-01T00:00:00.000Z",
  assignment: { id: "asg1", name: "Test Assignment" },
  questions: [{ id: "q1", index: 0, header: "Q1", maxScore: 10 }],
  students: [
    {
      id: "s1",
      name: "Alice Smith",
      answers: [{ answerId: "a1", questionId: "q1", questionIndex: 0, score: 8, maxScore: 10 }],
    },
    {
      id: "s2",
      name: "Bob Jones",
      answers: [{ answerId: "a2", questionId: "q1", questionIndex: 0, score: 5, maxScore: 10 }],
    },
  ],
};

// Injected into the page before any of its own scripts run. Backs
// chrome.storage.local with an in-memory object seeded with the test
// package, and lets the test script control what chrome.tabs.sendMessage
// returns for each message type via window.__mockResponses.
const CHROME_MOCK_INIT_SCRIPT = `
  window.__storageData = ${JSON.stringify({
    gridgraderCanvasPackage: testPackage,
    gridgraderCanvasPackageReceivedAt: Date.now(),
  })};
  window.__sendMessageLog = [];
  // message.type -> response object. Set before load so the popup's own
  // initial PING_CANVAS_PAGE (fired from loadFromStorage) sees it.
  // Canvas already shows Alice by the time the popup's own initial
  // load-time ping fires — matches the real flow, where canvasStatus
  // reflects whatever page you already had open, and only changes again
  // when you navigate (not when you just pick a different dropdown entry).
  window.__mockResponses = {
    PING_CANVAS_PAGE: { compatible: true, displayedStudentName: "Alice Smith" },
  };

  window.chrome = {
    runtime: { lastError: undefined },
    storage: {
      local: {
        get: (keys, cb) => {
          const result = {};
          keys.forEach((k) => { if (k in window.__storageData) result[k] = window.__storageData[k]; });
          cb(result);
        },
        set: (obj, cb) => { Object.assign(window.__storageData, obj); if (cb) cb(); },
        remove: (keys, cb) => { keys.forEach((k) => delete window.__storageData[k]); if (cb) cb(); },
      },
    },
    tabs: {
      query: (_opts, cb) => cb([{ id: 1 }]),
      sendMessage: (_tabId, message, cb) => {
        window.__sendMessageLog.push(message);
        const response = window.__mockResponses[message.type];
        cb(typeof response === "function" ? response(message) : response);
      },
    },
  };
`;

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(CHROME_MOCK_INIT_SCRIPT);

  const fixtureUrl = "file://" + path.resolve(__dirname, "../../src/popup/popup.html");
  await page.goto(fixtureUrl);
  await page.waitForTimeout(100);

  // 1. Package loaded, both students present, remaining count correct.
  const packageStatus = await page.textContent("#package-status");
  assert.match(packageStatus, /Test Assignment/);

  const optionTexts = await page.$$eval("#student-select option", (opts) =>
    opts.map((o) => o.textContent)
  );
  assert.deepEqual(optionTexts, ["Select a student…", "Alice Smith", "Bob Jones"]);

  const remainingText = await page.textContent("#remaining-count");
  assert.equal(remainingText, "2 of 2 students remaining");

  // 2. Selecting Alice, with Canvas already showing Alice (from the
  // initial ping) — expect MATCH and an enabled Update Grades button.
  await page.selectOption("#student-select", "s1");
  await page.waitForTimeout(50);

  const matchStatus = await page.textContent("#match-status");
  assert.match(matchStatus, /MATCH/);
  assert.equal(await page.isEnabled("#update-grades-btn"), true);

  // 3. Click Update Grades — mock a successful send, verify it's removed
  // from the dropdown and the remaining count drops.
  await page.evaluate(() => {
    window.__mockResponses["SEND_GRADES"] = { ok: true, filled: 1, updateScoresClicked: true };
  });
  await page.click("#update-grades-btn");
  await page.waitForTimeout(50);

  const resultText = await page.textContent("#result");
  assert.match(resultText, /Fields filled \(1\)/);
  assert.match(resultText, /Update Scores clicked/);

  const optionsAfterSend = await page.$$eval("#student-select option", (opts) =>
    opts.map((o) => o.textContent)
  );
  assert.deepEqual(optionsAfterSend, ["Select a student…", "Bob Jones"], "Alice should be gone from the dropdown");

  const remainingAfterSend = await page.textContent("#remaining-count");
  assert.equal(remainingAfterSend, "1 of 2 students remaining");

  // 4. Click Next — mock Canvas navigating and then showing Bob; expect
  // auto-select to pick Bob in the dropdown without being told to.
  await page.evaluate(() => {
    window.__mockResponses["CLICK_NEXT_STUDENT"] = { ok: true };
    window.__mockResponses["PING_CANVAS_PAGE"] = { compatible: true, displayedStudentName: "Bob Jones" };
  });
  await page.click("#next-student-btn");
  await page.waitForTimeout(800); // the popup's own 600ms settle delay

  const selectedAfterNav = await page.$eval("#student-select", (el) => el.value);
  assert.equal(selectedAfterNav, "s2", "Bob should be auto-selected after navigating to him");

  const matchStatusAfterNav = await page.textContent("#match-status");
  assert.match(matchStatusAfterNav, /MATCH/);

  // 5. Confirm the actual chrome.tabs.sendMessage calls had the right
  // shape (type/payload), not just that the mocked responses got read.
  const log = await page.evaluate(() => window.__sendMessageLog);
  assert.ok(log.some((m) => m.type === "PING_CANVAS_PAGE"));
  assert.ok(log.some((m) => m.type === "SEND_GRADES" && m.payload.selectedStudent.id === "s1"));
  assert.ok(log.some((m) => m.type === "CLICK_NEXT_STUDENT"));

  await browser.close();
  console.log("All popup fixture assertions passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
