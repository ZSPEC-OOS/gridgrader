// Plain-JS port of gridgrader's lib/canvas-transfer/schema.ts + message.ts.
// This MUST stay behaviorally identical to that file — it is the same
// contract, not a re-derived one. If GridGrader's schema changes, this
// file has to change with it (there is no shared build step between the
// two projects, so this is a manual sync point).
//
// No import/export — loaded as a plain content script and via a <script>
// tag in the popup, so everything attaches to a namespace object instead.

(function (global) {
  "use strict";

  var CANVAS_EXPORT_MESSAGE_SOURCE = "gridgrader-web";
  var CANVAS_EXPORT_MESSAGE_TYPE = "GRIDGRADER_CANVAS_EXPORT";

  function CanvasTransferValidationError(message) {
    var err = new Error(message);
    err.name = "CanvasTransferValidationError";
    return err;
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  // Throws on the first problem found. Returns the input unchanged (not
  // cloned) on success — callers should treat the input as immutable
  // afterward rather than relying on that, since JS can't enforce it here.
  function validateCanvasTransferPackage(pkg) {
    if (typeof pkg !== "object" || pkg === null) {
      throw CanvasTransferValidationError("Transfer package is not an object.");
    }

    if (pkg.schema !== "gridgrader.canvas-transfer") {
      throw CanvasTransferValidationError(
        "Unrecognized schema: " + JSON.stringify(pkg.schema) + "."
      );
    }
    if (pkg.version !== 1) {
      throw CanvasTransferValidationError(
        "Unsupported package version: " +
          JSON.stringify(pkg.version) +
          ". Only version 1 is supported."
      );
    }
    if (!isNonEmptyString(pkg.exportedAt) || Number.isNaN(Date.parse(pkg.exportedAt))) {
      throw CanvasTransferValidationError("exportedAt must be a valid ISO-8601 timestamp.");
    }

    var assignment = pkg.assignment;
    if (
      typeof assignment !== "object" ||
      assignment === null ||
      !isNonEmptyString(assignment.id) ||
      !isNonEmptyString(assignment.name)
    ) {
      throw CanvasTransferValidationError("assignment.id and assignment.name are required.");
    }

    if (!Array.isArray(pkg.questions) || pkg.questions.length === 0) {
      throw CanvasTransferValidationError("questions must be a non-empty array.");
    }

    var questionIds = {};
    var questionIndices = {};
    var maxScoreByQuestionId = {};
    var indexByQuestionId = {};
    var i, q;

    for (i = 0; i < pkg.questions.length; i++) {
      q = pkg.questions[i];
      if (!isNonEmptyString(q.id)) {
        throw CanvasTransferValidationError("questions[" + i + "].id must be a non-empty string.");
      }
      if (Object.prototype.hasOwnProperty.call(questionIds, q.id)) {
        throw CanvasTransferValidationError("Duplicate question id: " + q.id + ".");
      }
      questionIds[q.id] = true;

      if (!Number.isInteger(q.index) || q.index < 0) {
        throw CanvasTransferValidationError(
          "questions[" + i + "].index must be a non-negative integer."
        );
      }
      if (Object.prototype.hasOwnProperty.call(questionIndices, q.index)) {
        throw CanvasTransferValidationError("Duplicate question index: " + q.index + ".");
      }
      questionIndices[q.index] = true;

      if (!isNonEmptyString(q.header)) {
        throw CanvasTransferValidationError("questions[" + i + "].header must be a non-empty string.");
      }
      if (!isFiniteNumber(q.maxScore) || q.maxScore < 0) {
        throw CanvasTransferValidationError(
          "questions[" + i + "].maxScore must be a finite number >= 0."
        );
      }

      maxScoreByQuestionId[q.id] = q.maxScore;
      indexByQuestionId[q.id] = q.index;
    }

    var sortedIndices = Object.keys(questionIndices)
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      });
    for (i = 0; i < sortedIndices.length; i++) {
      if (sortedIndices[i] !== i) {
        throw CanvasTransferValidationError("Question indices must be contiguous starting at 0.");
      }
    }

    if (!Array.isArray(pkg.students) || pkg.students.length === 0) {
      throw CanvasTransferValidationError("students must be a non-empty array.");
    }

    var studentIds = {};
    var answerIds = {};
    var si, s, ai, a, where, expectedIndex, questionMaxScore;

    for (si = 0; si < pkg.students.length; si++) {
      s = pkg.students[si];
      if (!isNonEmptyString(s.id)) {
        throw CanvasTransferValidationError("students[" + si + "].id must be a non-empty string.");
      }
      if (Object.prototype.hasOwnProperty.call(studentIds, s.id)) {
        throw CanvasTransferValidationError("Duplicate student id: " + s.id + ".");
      }
      studentIds[s.id] = true;

      if (!isNonEmptyString(s.name)) {
        throw CanvasTransferValidationError("students[" + si + "].name must be a non-empty string.");
      }

      if (!Array.isArray(s.answers)) {
        throw CanvasTransferValidationError("students[" + si + "].answers must be an array.");
      }

      for (ai = 0; ai < s.answers.length; ai++) {
        a = s.answers[ai];
        where = "students[" + si + "].answers[" + ai + "]";

        if (!isNonEmptyString(a.answerId)) {
          throw CanvasTransferValidationError(where + ".answerId must be a non-empty string.");
        }
        if (Object.prototype.hasOwnProperty.call(answerIds, a.answerId)) {
          throw CanvasTransferValidationError("Duplicate answer id: " + a.answerId + ".");
        }
        answerIds[a.answerId] = true;

        if (
          !isNonEmptyString(a.questionId) ||
          !Object.prototype.hasOwnProperty.call(maxScoreByQuestionId, a.questionId)
        ) {
          throw CanvasTransferValidationError(where + ".questionId does not reference a known question.");
        }

        expectedIndex = indexByQuestionId[a.questionId];
        if (a.questionIndex !== expectedIndex) {
          throw CanvasTransferValidationError(
            where +
              ".questionIndex (" +
              a.questionIndex +
              ") does not match question " +
              a.questionId +
              "'s index (" +
              expectedIndex +
              ")."
          );
        }

        questionMaxScore = maxScoreByQuestionId[a.questionId];
        if (!isFiniteNumber(a.maxScore) || a.maxScore !== questionMaxScore) {
          throw CanvasTransferValidationError(
            where +
              ".maxScore (" +
              a.maxScore +
              ") does not match question " +
              a.questionId +
              "'s maxScore (" +
              questionMaxScore +
              ")."
          );
        }

        if (a.score !== null) {
          if (!isFiniteNumber(a.score) || a.score < 0 || a.score > questionMaxScore) {
            throw CanvasTransferValidationError(
              where + ".score (" + a.score + ") must be null or a finite number between 0 and " + questionMaxScore + "."
            );
          }
        }
      }
    }

    return pkg;
  }

  function packageHasIncompleteScores(pkg) {
    return pkg.students.some(function (s) {
      return s.answers.some(function (a) {
        return a.score === null;
      });
    });
  }

  function createCanvasExportMessage(payload) {
    return {
      source: CANVAS_EXPORT_MESSAGE_SOURCE,
      type: CANVAS_EXPORT_MESSAGE_TYPE,
      payload: payload,
    };
  }

  var GridGraderTransferSchema = {
    CANVAS_EXPORT_MESSAGE_SOURCE: CANVAS_EXPORT_MESSAGE_SOURCE,
    CANVAS_EXPORT_MESSAGE_TYPE: CANVAS_EXPORT_MESSAGE_TYPE,
    validateCanvasTransferPackage: validateCanvasTransferPackage,
    packageHasIncompleteScores: packageHasIncompleteScores,
    createCanvasExportMessage: createCanvasExportMessage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GridGraderTransferSchema;
  } else {
    global.GridGraderTransferSchema = GridGraderTransferSchema;
  }
})(typeof window !== "undefined" ? window : globalThis);
