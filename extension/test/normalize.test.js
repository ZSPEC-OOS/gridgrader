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
