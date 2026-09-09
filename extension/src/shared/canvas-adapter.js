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
// STATUS: NOT IMPLEMENTED FOR YOUR CANVAS INSTANCE YET.
//
// Canvas's SpeedGrader DOM varies by institution, quiz type, and release,
// and the design doc this extension was built from explicitly says: do
// not invent production selectors. Before this adapter can safely write
// a real grade, it needs, captured from your actual Canvas page's dev
// tools:
//   1. The <input> element for one question-level score box.
//   2. The nearest enclosing question-container HTML/class/data attrs.
//   3. The element containing the currently displayed student's name.
//   4. The element/text containing that question's maximum points.
//   5. Whether entering a score and blurring it auto-saves in Canvas,
//      or requires an extra action.
//
// Until then, isCompatiblePage() always returns false, so the popup
// will correctly show "wrong page" / disable Send Grades on every page
// rather than risk a false positive. Fill in a real adapter below once
// you have that information — see extension/README.md.
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

  // Swap this to a real adapter instance once selectors are confirmed.
  // Keeping it as a single assignment point means nothing else in the
  // extension needs to change to go from "stub" to "real".
  var ACTIVE_ADAPTER = new NotImplementedCanvasAdapter();

  function createAdapter() {
    return ACTIVE_ADAPTER;
  }

  var GridGraderCanvasAdapter = {
    setInputValueNative: setInputValueNative,
    NotImplementedCanvasAdapter: NotImplementedCanvasAdapter,
    createAdapter: createAdapter,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GridGraderCanvasAdapter;
  } else {
    global.GridGraderCanvasAdapter = GridGraderCanvasAdapter;
  }
})(typeof window !== "undefined" ? window : globalThis);
