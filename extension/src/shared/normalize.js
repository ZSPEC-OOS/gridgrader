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
      // Strip a trailing "(...)" annotation — e.g. a pronoun tag like
      // "(She/Her)" that may be present on one side (a roster's raw name
      // field, or Canvas's own displayed text) and not the other. This is
      // a defined, harmless formatting difference, not fuzzy matching: it
      // doesn't tolerate typos or near-misses, it just ignores a bracketed
      // suffix that doesn't change who the name refers to. A parenthetical
      // in the middle of a name (e.g. a nickname) is left alone.
      .replace(/\s*\([^)]*\)\s*$/, "")
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
