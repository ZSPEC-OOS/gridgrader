// CanvasAdapter isolates every Canvas-specific DOM selector and extraction
// rule behind one small interface, per the design doc's explicit
// instruction: "Do not scatter selectors through popup or storage code."
//
// CanvasAdapter contract (documented in JS since there's no TS here):
//   isCompatiblePage(): boolean
//   getDisplayedStudentName(): string | null
//   getQuestionTargets(): Array<{ index: number, input: HTMLInputElement, maxScore: number | null }>
//   setScore(input: HTMLInputElement, value: number): void
//
// ---------------------------------------------------------------------
// STATUS: implemented against confirmed real markup from ONE Canvas
// Classic Quizzes SpeedGrader page (webcampus.unr.edu, essay-type
// questions). Still open before trusting this on a real roster:
//   - Blur-autosave behavior hasn't been confirmed yet (does leaving
//     the field save it in Canvas, or does something else need to
//     happen?). See extension/README.md.
//   - Only essay-type questions have been confirmed. Multiple-choice,
//     fill-in-blank, etc. question types may render this differently —
//     don't assume this adapter covers them until checked.
//   - Test end-to-end on a disposable/test submission before using on
//     a real assignment, per the design doc this was built from.
// ---------------------------------------------------------------------

(function (global) {
  "use strict";

  // Setting `.value` directly doesn't reliably work on a framework-managed
  // input (React et al. wrap the native setter to track state internally),
  // so the input appears to change but the framework never sees the edit.
  // Using the native prototype setter, then dispatching the same events a
  // real keystroke would fire, is the standard workaround.
  function setInputValueNative(input, value) {
    var setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;

    if (!setter) {
      throw new Error("Native HTMLInputElement value setter unavailable.");
    }

    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  }

  function NotImplementedCanvasAdapter() {}
  NotImplementedCanvasAdapter.prototype.isCompatiblePage = function () {
    return false;
  };
  NotImplementedCanvasAdapter.prototype.getDisplayedStudentName = function () {
    return null;
  };
  NotImplementedCanvasAdapter.prototype.getQuestionTargets = function () {
    return [];
  };
  NotImplementedCanvasAdapter.prototype.setScore = function () {
    throw new Error(
      "Canvas adapter not implemented for this institution's markup yet — see extension/README.md."
    );
  };

  // Canvas's own header text reads like:
  //   " Quiz 1: Ch19, 20, 21- Requires Respondus LockDown Browser Results for Kaitlyn Zatek (She/Her) "
  // — quiz title, then a fixed "Results for <name> (<pronoun>)" suffix
  // Canvas appends itself. The pronoun parenthetical is optional (a
  // student with no pronouns set won't have one).
  function extractStudentNameFromHeaderText(rawText) {
    var match = rawText.match(/Results for\s+(.+?)\s*(?:\([^)]*\))?\s*$/);
    return match ? match[1].trim() : null;
  }

  // Reads only the <h2>'s own text nodes, skipping its nested "View Log"
  // <a> child — that link's text would otherwise get appended to the
  // name text.
  function getHeaderH2Text() {
    var h2 = document.querySelector("header h2");
    if (!h2) return null;
    var text = "";
    Array.prototype.forEach.call(h2.childNodes, function (node) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
    });
    return text;
  }

  // The max-score text sits in a sibling <span class="question_points">
  // reading like " / 2" — same shared .user_points parent as the score
  // input itself.
  function extractMaxScore(input) {
    var holder = input.closest(".user_points");
    if (!holder) return null;
    var pointsEl = holder.querySelector(".question_points");
    if (!pointsEl) return null;
    var match = pointsEl.textContent.match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : null;
  }

  function RealCanvasAdapter() {}

  RealCanvasAdapter.prototype.isCompatiblePage = function () {
    return (
      document.querySelectorAll("input.question_input[data-question-id]").length > 0 &&
      !!document.querySelector("header h2")
    );
  };

  RealCanvasAdapter.prototype.getDisplayedStudentName = function () {
    var raw = getHeaderH2Text();
    return raw ? extractStudentNameFromHeaderText(raw) : null;
  };

  RealCanvasAdapter.prototype.getQuestionTargets = function () {
    var inputs = document.querySelectorAll("input.question_input[data-question-id]");
    var targets = [];
    for (var i = 0; i < inputs.length; i++) {
      targets.push({
        index: i,
        input: inputs[i],
        maxScore: extractMaxScore(inputs[i]),
      });
    }
    return targets;
  };

  RealCanvasAdapter.prototype.setScore = function (input, value) {
    setInputValueNative(input, value);
  };

  // The single point that switches the extension from stub to real —
  // nothing else needs to change to go the other direction either, if
  // this turns out not to hold up on other question types.
  var ACTIVE_ADAPTER = new RealCanvasAdapter();

  function createAdapter() {
    return ACTIVE_ADAPTER;
  }

  var GridGraderCanvasAdapter = {
    setInputValueNative: setInputValueNative,
    NotImplementedCanvasAdapter: NotImplementedCanvasAdapter,
    RealCanvasAdapter: RealCanvasAdapter,
    extractStudentNameFromHeaderText: extractStudentNameFromHeaderText,
    createAdapter: createAdapter,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GridGraderCanvasAdapter;
  } else {
    global.GridGraderCanvasAdapter = GridGraderCanvasAdapter;
  }
})(typeof window !== "undefined" ? window : globalThis);
