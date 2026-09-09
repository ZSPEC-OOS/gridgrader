const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeName, namesMatch } = require("../src/shared/normalize.js");

test("trims and collapses whitespace", () => {
  assert.equal(normalizeName("  Alice   Smith  "), "alice smith");
});

test("is case-insensitive", () => {
  assert.equal(normalizeName("ALICE SMITH"), normalizeName("alice smith"));
});

test("normalizes Unicode form (NFKC)", () => {
  // "é" as a single codepoint vs. "e" + combining acute accent.
  const nfc = "Alice Bebé";
  const decomposed = "Alice Bebé";
  assert.equal(normalizeName(nfc), normalizeName(decomposed));
});

test("namesMatch is true for harmless formatting differences", () => {
  assert.equal(namesMatch("Alice Smith", "  alice   smith "), true);
});

test("namesMatch is false for actually different names — no fuzzy matching", () => {
  assert.equal(namesMatch("Alice Smith", "Alicia Smith"), false);
  assert.equal(namesMatch("Alice Smith", "Alice Smyth"), false);
});

test("namesMatch is false when either side is empty/missing", () => {
  assert.equal(namesMatch("", "Alice"), false);
  assert.equal(namesMatch("Alice", ""), false);
  assert.equal(namesMatch(null, "Alice"), false);
});

test("strips a trailing pronoun annotation on either side, so one side having it doesn't block a real match", () => {
  // The actual bug this fixes: a roster name like "Annie Aakhus (She/Her)"
  // (pronoun included verbatim in the source data) failed to match
  // Canvas's displayed "Annie Aakhus" (pronoun already stripped by the
  // header parser) because only one side had it removed.
  assert.equal(namesMatch("Annie Aakhus (She/Her)", "Annie Aakhus"), true);
  assert.equal(namesMatch("Annie Aakhus", "Annie Aakhus (She/Her)"), true);
  assert.equal(namesMatch("Annie Aakhus (She/Her)", "Annie Aakhus (She/Her)"), true);
});

test("does not strip a parenthetical in the middle of a name", () => {
  // Only a *trailing* "(...)" is treated as an annotation to ignore — a
  // parenthetical elsewhere (e.g. a nickname) is part of the name and
  // still has to match exactly.
  assert.equal(normalizeName("Robert (Bob) Smith"), "robert (bob) smith");
  assert.equal(namesMatch("Robert (Bob) Smith", "Robert Smith"), false);
});
