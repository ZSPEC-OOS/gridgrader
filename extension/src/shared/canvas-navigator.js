// CanvasNavigator isolates the student-navigation controls (prev/next
// student) in Canvas's SpeedGrader top bar. This is a DIFFERENT document
// from the one CanvasAdapter operates on — the score-entry markup lives
// in an iframe, but these prev/next buttons live in the parent top-frame
// page. A content script running in the top frame uses this; the same
// content script running in the score iframe uses canvas-adapter.js
// instead. See canvas.js for how the two are told apart at runtime.
//
// Confirmed real markup (webcampus.unr.edu):
//   <button id="next-student-button" data-testid="next-student-button" ...>
//   <button id="prev-student-button" data-testid="previous-student-button" ...>
// (Note the testids aren't symmetric — "previous", not "prev" — which is
// exactly why this was confirmed rather than guessed from the id pattern
// alone. Keying off the ids since those ARE symmetric and simpler.)
//
// CanvasNavigator contract:
//   isAvailable(): boolean
//   canGoNext(): boolean
//   canGoPrev(): boolean
//   clickNext(): boolean
//   clickPrev(): boolean

(function (global) {
  "use strict";

  function findNextButton() {
    return document.getElementById("next-student-button");
  }

  function findPrevButton() {
    return document.getElementById("prev-student-button");
  }

  function NotImplementedCanvasNavigator() {}
  NotImplementedCanvasNavigator.prototype.isAvailable = function () {
    return false;
  };
  NotImplementedCanvasNavigator.prototype.canGoNext = function () {
    return false;
  };
  NotImplementedCanvasNavigator.prototype.canGoPrev = function () {
    return false;
  };
  NotImplementedCanvasNavigator.prototype.clickNext = function () {
    return false;
  };
  NotImplementedCanvasNavigator.prototype.clickPrev = function () {
    return false;
  };

  function RealCanvasNavigator() {}

  RealCanvasNavigator.prototype.isAvailable = function () {
    return !!(findNextButton() || findPrevButton());
  };

  RealCanvasNavigator.prototype.canGoNext = function () {
    var btn = findNextButton();
    return !!btn && !btn.disabled;
  };

  RealCanvasNavigator.prototype.canGoPrev = function () {
    var btn = findPrevButton();
    return !!btn && !btn.disabled;
  };

  RealCanvasNavigator.prototype.clickNext = function () {
    var btn = findNextButton();
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  };

  RealCanvasNavigator.prototype.clickPrev = function () {
    var btn = findPrevButton();
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  };

  var ACTIVE_NAVIGATOR = new RealCanvasNavigator();

  function createNavigator() {
    return ACTIVE_NAVIGATOR;
  }

  var GridGraderCanvasNavigator = {
    NotImplementedCanvasNavigator: NotImplementedCanvasNavigator,
    RealCanvasNavigator: RealCanvasNavigator,
    createNavigator: createNavigator,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GridGraderCanvasNavigator;
  } else {
    global.GridGraderCanvasNavigator = GridGraderCanvasNavigator;
  }
})(typeof window !== "undefined" ? window : globalThis);
