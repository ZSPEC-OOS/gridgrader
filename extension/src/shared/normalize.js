// Student-identity is the highest-priority safety check in this extension
// (see canvas.js). Normalization is deliberately narrow — it only smooths
// harmless formatting differences. It never does fuzzy/approximate
// matching; a name that differs by more than whitespace/case/Unicode form
// is a mismatch, full stop.

(function (global) {
  "use strict";

  function normalizeName(name) {
    if (typeof name !== "string") return "";
    return name
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function namesMatch(a, b) {
    return normalizeName(a) === normalizeName(b) && normalizeName(a).length > 0;
  }

  var GridGraderNormalize = {
    normalizeName: normalizeName,
    namesMatch: namesMatch,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GridGraderNormalize;
  } else {
    global.GridGraderNormalize = GridGraderNormalize;
  }
})(typeof window !== "undefined" ? window : globalThis);
