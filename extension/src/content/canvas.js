// Canvas-page content script: runs the "never write to the wrong student
// or wrong question" preflight, then — only if every check passes — fills
// the score inputs and verifies each write.
//
// The orchestration logic (runPing / runSendGrades) is written as pure
// functions that take the adapter and normalizer as parameters, so it can
// be unit-tested with a fake adapter and no real Canvas page or `chrome`
// global — see extension/test/canvas.test.js.

(function (global) {
  "use strict";

  function runPing(adapter) {
    var compatible = adapter.isCompatiblePage();
    return {
      compatible: compatible,
      displayedStudentName: compatible ? adapter.getDisplayedStudentName() : null,
    };
  }

  // request: { selectedStudent: { id, name, answers: [{questionIndex, maxScore, score}] }, debug?: boolean }
  function runSendGrades(adapter, normalize, request) {
    var selectedStudent = request.selectedStudent;
    var debugInfo;

    if (!adapter.isCompatiblePage()) {
      return blocked("wrong_page", "Not on a compatible Canvas grading page.");
    }

    var displayedName = adapter.getDisplayedStudentName();
    if (!displayedName) {
      return blocked(
        "student_undetected",
        "Could not detect the currently displayed Canvas student. Navigate to the student manually and retry."
      );
    }

    if (!normalize.namesMatch(displayedName, selectedStudent.name)) {
      return blocked("student_mismatch", "Selected student does not match the Canvas page.", {
        selectedName: selectedStudent.name,
        displayedName: displayedName,
      });
    }

    var targets = adapter.getQuestionTargets();

    if (request.debug) {
      debugInfo = {
        displayedStudentName: displayedName,
        questionTargetCount: targets.length,
        extractedMaxScores: targets.map(function (t) {
          return t.maxScore;
        }),
        mappingIndices: targets.map(function (t) {
          return t.index;
        }),
      };
    }

    if (targets.length !== selectedStudent.answers.length) {
      return blocked(
        "question_count_mismatch",
        "Expected " +
          selectedStudent.answers.length +
          " question(s) but found " +
          targets.length +
          " on the Canvas page.",
        null,
        debugInfo
      );
    }

    var targetsByIndex = {};
    targets.forEach(function (t) {
      targetsByIndex[t.index] = t;
    });

    var answersByIndex = {};
    selectedStudent.answers.forEach(function (a) {
      answersByIndex[a.questionIndex] = a;
    });

    var i, target, answer;

    // Max-score cross-check, before anything else — a mismatch here means
    // the rubric changed since export, and writing under a stale rubric
    // would silently misgrade.
    for (i = 0; i < selectedStudent.answers.length; i++) {
      answer = selectedStudent.answers[i];
      target = targetsByIndex[answer.questionIndex];
      if (!target) {
        return blocked(
          "question_count_mismatch",
          "No Canvas question found at index " + answer.questionIndex + ".",
          null,
          debugInfo
        );
      }
      if (target.maxScore !== null && target.maxScore !== answer.maxScore) {
        return blocked(
          "max_score_mismatch",
          "Question " +
            answer.questionIndex +
            ": GridGrader max is " +
            answer.maxScore +
            " but Canvas shows " +
            target.maxScore +
            ".",
          { questionIndex: answer.questionIndex },
          debugInfo
        );
      }
    }

    // Null/ungraded scores are never silently sent as zero.
    for (i = 0; i < selectedStudent.answers.length; i++) {
      answer = selectedStudent.answers[i];
      if (answer.score === null || !Number.isFinite(answer.score)) {
        return blocked(
          "null_score",
          "Question " + answer.questionIndex + " has no score to send.",
          { questionIndex: answer.questionIndex },
          debugInfo
        );
      }
    }

    for (i = 0; i < selectedStudent.answers.length; i++) {
      answer = selectedStudent.answers[i];
      target = targetsByIndex[answer.questionIndex];
      if (!target.input || target.input.disabled || target.input.readOnly) {
        return blocked(
          "input_not_editable",
          "Question " + answer.questionIndex + "'s input is not editable.",
          { questionIndex: answer.questionIndex },
          debugInfo
        );
      }
    }

    // Preflight passed. Write and verify one at a time, stopping
    // immediately (reporting partial progress) if a write doesn't stick —
    // never assume the DOM held still for the whole batch.
    var filled = 0;
    for (i = 0; i < selectedStudent.answers.length; i++) {
      answer = selectedStudent.answers[i];
      target = targetsByIndex[answer.questionIndex];

      adapter.setScore(target.input, answer.score);
      var written = parseFloat(target.input.value);
      if (written !== answer.score) {
        return {
          ok: false,
          reason: "write_verification_failed",
          message:
            "Question " +
            answer.questionIndex +
            " did not verify after writing (expected " +
            answer.score +
            ", read back " +
            target.input.value +
            ").",
          filled: filled,
          detail: { questionIndex: answer.questionIndex },
          debug: debugInfo,
        };
      }
      filled++;
    }

    return { ok: true, filled: filled, debug: debugInfo };
  }

  function blocked(reason, message, detail, debugInfo) {
    return {
      ok: false,
      reason: reason,
      message: message,
      filled: 0,
      detail: detail || null,
      debug: debugInfo,
    };
  }

  var GridGraderCanvasContent = {
    runPing: runPing,
    runSendGrades: runSendGrades,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GridGraderCanvasContent;
    return;
  }

  global.GridGraderCanvasContent = GridGraderCanvasContent;

  // Browser wiring — only registered when actually running as a content
  // script. The popup sends PING and SEND_GRADES; nothing here ever fires
  // without the popup asking for it (no auto-send on page load).
  //
  // Classic Quiz SpeedGrader renders the actual question/score markup
  // inside an iframe, so this script has to run in every frame
  // (manifest's `all_frames: true`) to ever find it. That means more than
  // one frame in the same tab could receive the popup's message — the top
  // page (no quiz markup) and the quiz iframe (has it). Rather than rely
  // on unspecified behavior for what happens when multiple frames answer
  // the same chrome.tabs.sendMessage call, only the frame that actually
  // finds a compatible page registers a listener at all. Every other
  // frame stays silent, so there is only ever zero or one real responder.
  var adapter = global.GridGraderCanvasAdapter.createAdapter();
  if (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.onMessage &&
    adapter.isCompatiblePage()
  ) {
    chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
      var normalize = global.GridGraderNormalize;

      if (message && message.type === "PING_CANVAS_PAGE") {
        sendResponse(runPing(adapter));
        return true;
      }
      if (message && message.type === "SEND_GRADES") {
        sendResponse(runSendGrades(adapter, normalize, message.payload || {}));
        return true;
      }
      return false;
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
