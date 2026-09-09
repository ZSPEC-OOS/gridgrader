const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runPing, runSendGrades, runGoToStudent } = require("../src/content/canvas.js");
const { namesMatch } = require("../src/shared/normalize.js");

function fakeInput() {
  return { value: "", disabled: false, readOnly: false };
}

function makeAdapter(opts) {
  const calls = [];
  const updateScoresCalls = [];
  return {
    calls: calls,
    updateScoresCalls: updateScoresCalls,
    isCompatiblePage: () => opts.compatible !== false,
    getDisplayedStudentName: () => (opts.displayedName === undefined ? "Alice Smith" : opts.displayedName),
    getQuestionTargets: () => opts.targets || [],
    setScore: (input, value) => {
      calls.push({ input, value });
      if (opts.brokenWriteAt !== undefined && calls.length - 1 === opts.brokenWriteAt) {
        // Simulate a write that doesn't actually stick.
        return;
      }
      input.value = String(value);
    },
    hasUpdateScoresButton: () => opts.hasUpdateScoresButton !== false,
    clickUpdateScores: () => {
      updateScoresCalls.push(true);
      return opts.updateScoresClickSucceeds !== false;
    },
  };
}

const normalize = { namesMatch: namesMatch };

function twoQuestionAnswers() {
  return [
    { questionIndex: 0, score: 8, maxScore: 10 },
    { questionIndex: 1, score: 2, maxScore: 2 },
  ];
}

function twoMatchingTargets() {
  return [
    { index: 0, input: fakeInput(), maxScore: 10 },
    { index: 1, input: fakeInput(), maxScore: 2 },
  ];
}

test("runPing reports compatible + displayed name", () => {
  const adapter = makeAdapter({ compatible: true, displayedName: "Alice Smith" });
  assert.deepEqual(runPing(adapter), { compatible: true, displayedStudentName: "Alice Smith" });
});

test("runPing reports incompatible page without calling getDisplayedStudentName's result", () => {
  const adapter = makeAdapter({ compatible: false });
  assert.deepEqual(runPing(adapter), { compatible: false, displayedStudentName: null });
});

test("blocks on wrong page and writes nothing", () => {
  const adapter = makeAdapter({ compatible: false, targets: twoMatchingTargets() });
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "wrong_page");
  assert.equal(adapter.calls.length, 0);
});

test("blocks when Canvas student can't be detected and writes nothing", () => {
  const adapter = makeAdapter({ compatible: true, displayedName: null, targets: twoMatchingTargets() });
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "student_undetected");
  assert.equal(adapter.calls.length, 0);
});

test("blocks on a student name mismatch and writes nothing — never fuzzy-matches", () => {
  const adapter = makeAdapter({ compatible: true, displayedName: "Bob Jones", targets: twoMatchingTargets() });
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "student_mismatch");
  assert.deepEqual(result.detail, { selectedName: "Alice Smith", displayedName: "Bob Jones" });
  assert.equal(adapter.calls.length, 0);
});

test("blocks on a question-count mismatch and writes nothing", () => {
  const adapter = makeAdapter({ compatible: true, targets: [twoMatchingTargets()[0]] }); // only 1 target
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() }, // 2 answers
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "question_count_mismatch");
  assert.equal(adapter.calls.length, 0);
});

test("blocks on a max-score mismatch, identifying the mismatched question, and writes nothing", () => {
  const targets = twoMatchingTargets();
  targets[1].maxScore = 5; // GridGrader says 2, Canvas shows 5
  const adapter = makeAdapter({ compatible: true, targets: targets });
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "max_score_mismatch");
  assert.deepEqual(result.detail, { questionIndex: 1 });
  assert.equal(adapter.calls.length, 0);
});

test("blocks on a null/ungraded score and writes nothing", () => {
  const adapter = makeAdapter({ compatible: true, targets: twoMatchingTargets() });
  const answers = twoQuestionAnswers();
  answers[1].score = null;
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: answers },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "null_score");
  assert.equal(adapter.calls.length, 0);
});

test("blocks when a target input is not editable and writes nothing", () => {
  const targets = twoMatchingTargets();
  targets[0].input.disabled = true;
  const adapter = makeAdapter({ compatible: true, targets: targets });
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "input_not_editable");
  assert.equal(adapter.calls.length, 0);
});

test("on a full match, fills every field in order, verifies each write, and clicks Update Scores", () => {
  const targets = twoMatchingTargets();
  const adapter = makeAdapter({ compatible: true, targets: targets });
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() },
  });
  assert.equal(result.ok, true);
  assert.equal(result.filled, 2);
  assert.equal(adapter.calls.length, 2);
  assert.equal(targets[0].input.value, "8");
  assert.equal(targets[1].input.value, "2");
  assert.equal(result.updateScoresClicked, true);
  assert.equal(adapter.updateScoresCalls.length, 1);
});

test("blocks before writing anything if the Update Scores button isn't found", () => {
  const targets = twoMatchingTargets();
  const adapter = makeAdapter({ compatible: true, targets: targets, hasUpdateScoresButton: false });
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "update_scores_button_missing");
  assert.equal(adapter.calls.length, 0);
  assert.equal(adapter.updateScoresCalls.length, 0);
});

test("reports updateScoresClicked: false if the click itself reports failure, without un-filling anything", () => {
  const targets = twoMatchingTargets();
  const adapter = makeAdapter({ compatible: true, targets: targets, updateScoresClickSucceeds: false });
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() },
  });
  assert.equal(result.ok, true);
  assert.equal(result.filled, 2);
  assert.equal(result.updateScoresClicked, false);
});

test("stops immediately on a write that fails to verify, reporting partial progress", () => {
  const targets = twoMatchingTargets();
  // Second write (index 1 in call order) doesn't actually stick.
  const adapter = makeAdapter({ compatible: true, targets: targets, brokenWriteAt: 1 });
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "write_verification_failed");
  assert.equal(result.filled, 1); // the first write succeeded before the second failed
  assert.equal(adapter.calls.length, 2); // it attempted the second write, then stopped
});

test("debug mode returns diagnostics without leaking student answer text", () => {
  const targets = twoMatchingTargets();
  const adapter = makeAdapter({ compatible: true, targets: targets });
  const result = runSendGrades(adapter, normalize, {
    selectedStudent: { id: "s1", name: "Alice Smith", answers: twoQuestionAnswers() },
    debug: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.debug.questionTargetCount, 2);
  assert.deepEqual(result.debug.mappingIndices, [0, 1]);
  assert.deepEqual(result.debug.extractedMaxScores, [10, 2]);
});

function makeNavigator(opts) {
  const nextCalls = [];
  const prevCalls = [];
  return {
    nextCalls: nextCalls,
    prevCalls: prevCalls,
    canGoNext: () => opts.canGoNext !== false,
    canGoPrev: () => opts.canGoPrev !== false,
    clickNext: () => {
      nextCalls.push(true);
      return opts.clickSucceeds !== false;
    },
    clickPrev: () => {
      prevCalls.push(true);
      return opts.clickSucceeds !== false;
    },
  };
}

test("runGoToStudent clicks next when available", () => {
  const nav = makeNavigator({});
  const result = runGoToStudent(nav, "next");
  assert.equal(result.ok, true);
  assert.equal(nav.nextCalls.length, 1);
  assert.equal(nav.prevCalls.length, 0);
});

test("runGoToStudent clicks prev when available", () => {
  const nav = makeNavigator({});
  const result = runGoToStudent(nav, "prev");
  assert.equal(result.ok, true);
  assert.equal(nav.prevCalls.length, 1);
  assert.equal(nav.nextCalls.length, 0);
});

test("runGoToStudent does not click next when it's not available (e.g. last student)", () => {
  const nav = makeNavigator({ canGoNext: false });
  const result = runGoToStudent(nav, "next");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_available");
  assert.equal(nav.nextCalls.length, 0);
});

test("runGoToStudent does not click prev when it's not available (e.g. first student)", () => {
  const nav = makeNavigator({ canGoPrev: false });
  const result = runGoToStudent(nav, "prev");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_available");
  assert.equal(nav.prevCalls.length, 0);
});
