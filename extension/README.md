# GridGrader Canvas Companion

A Manifest V3 browser extension that receives a graded assignment from
GridGrader and fills Canvas SpeedGrader's question-level score fields —
only after checking the displayed student and the question max-scores
match exactly. It never calls the Canvas API and never stores a Canvas
credential.

**Status: wired against real markup from one Canvas Classic Quizzes
SpeedGrader page (webcampus.unr.edu, essay-type questions), verified
against a saved HTML fixture — but not yet confirmed on a real, live
Canvas page end-to-end.** Two things still open, both in "Before trusting
this on a real roster" below: whether blur alone autosaves in Canvas, and
whether other question types (multiple choice, fill-in-blank, etc.) use
the same markup shape.

## Install (no build step)

1. `manifest.json` already points at the confirmed real domains
   (`gridgrader.vercel.app` and `webcampus.unr.edu`) — edit these only if
   your GridGrader deployment or Canvas institution differs.
2. In Chrome or Edge, go to `chrome://extensions` (`edge://extensions` on
   Edge), enable **Developer mode**, click **Load unpacked**, and select
   this `extension/` folder.
3. That's it — no `npm install`, no build. Everything here is plain
   JavaScript loaded directly by the browser.

## Operator procedure (the safe workflow)

1. Finish grading an assignment in GridGrader.
2. On the Grid Grader page, click **Send to Canvas Extension**.
3. Open the Canvas SpeedGrader page for that assignment.
4. Open this extension's popup, pick the student from the dropdown, and
   check the match status.
5. Only if it says **MATCH** — never on MISMATCH or UNDETECTED — click
   **Send Grades**.
6. Confirm in Canvas that the fields show the values you expect. The
   extension reports "fields filled," not "Canvas confirmed saved" —
   those are different claims (see `src/content/canvas.js`).

## Before trusting this on a real roster

`src/shared/canvas-adapter.js`'s `RealCanvasAdapter` is built from actual
captured markup (see `test/fixtures/canvas-quiz-page.html` for the exact
HTML it was verified against), not guessed selectors. What it does:

- Finds every score input via `input.question_input[data-question-id]`,
  in document order (Canvas's own id numbers aren't sequential, so order
  is what's trustworthy, matching the design doc's MVP mapping strategy).
- Reads the max score from the sibling `.question_points` span.
- Reads the displayed student name from `header h2`'s own text (skipping
  its nested "View Log" link), parsing Canvas's `Results for <name>
  (<pronoun>)` template.
- Writes via the native `HTMLInputElement` setter plus dispatched
  `input`/`change` events and a blur — necessary because Canvas keeps a
  second, hidden input (`question_input_hidden`) in sync with the visible
  one via its own JS, which only fires on a real-looking edit.

Two things are **not** yet confirmed on an actual live Canvas page:

1. **Autosave.** Does leaving the field (blur) alone save it in Canvas,
   or is another action needed? Test with a disposable/test submission:
   type a value, blur, reload the page, see if it held.
2. **Other question types.** Only essay-type questions have been
   confirmed. If a question is multiple-choice, fill-in-the-blank, etc.,
   check its markup before assuming this adapter covers it — it may not.

If markup differs from what's here, update `RealCanvasAdapter` (and
`test/fixtures/canvas-quiz-page.html` to match) — `canvas.js`'s
preflight/send logic and the popup are written against the adapter
interface, not against Canvas markup directly, so nothing else needs to
change.

## Running the tests

```bash
npm test
```

(Just `node --test test/*.test.js` under the hood — no dependencies to
install. This is a dev convenience; end users never need to run it.)
Covers: transfer-package schema validation, the GridGrader receiver's
origin/source/type filtering, student-name normalization, the header-text
name-extraction parsing, and the preflight logic proving zero DOM writes
occur on any blocking mismatch (wrong page, undetected/mismatched
student, question-count or max-score mismatch, null score, non-editable
input) — all against a fake adapter, since none of that needs a real
Canvas page.

There's one additional test that needs a real browser (Playwright),
which is why it's kept separate from `npm test` rather than folded in:

```bash
node test/fixtures/run-fixture-test.js
```

This runs the actual `RealCanvasAdapter` — the same code that runs
against live Canvas — against the saved fixture in
`test/fixtures/canvas-quiz-page.html`, checking page-compatibility
detection, student-name extraction, question ordering/max-score
extraction, and that a write actually lands and fires the right events.
It does not touch a real Canvas page; it's the closest thing to that
without one.

## Architecture

```
GridGrader page --postMessage--> GridGrader content script --validate--> chrome.storage.local
                                                                                |
                                                                                v
                                                                        Extension popup
                                                                                |
                                                          selected student + SEND_GRADES
                                                                                v
                                                                    Canvas content script
                                                                       (preflight, then
                                                                        fill + verify)
```

- `src/shared/transfer-schema.js` — the exact same versioned contract as
  GridGrader's `lib/canvas-transfer/schema.ts`. Kept in sync by hand;
  there's no shared build between the two projects.
- `src/shared/normalize.js` — exact-match-only student name comparison.
- `src/shared/canvas-adapter.js` — isolates all Canvas-specific selectors
  behind one interface (see above).
- `src/content/gridgrader.js` — listens on the GridGrader origin only,
  validates, writes to `chrome.storage.local`.
- `src/content/canvas.js` — preflight-then-write orchestration on the
  Canvas origin. Nothing is written unless every check passes first.
- `src/popup/` — status display, student picker, match indicator, Send
  Grades / Clear buttons, optional debug mode.

## Non-goals (by design)

No Canvas API integration, no automatic roster traversal, no fuzzy name
matching, no silent partial sends, no automatic final submission. See the
GridGrader repo's design documents this extension was built from for the
full rationale.
