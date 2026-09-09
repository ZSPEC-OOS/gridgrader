# GridGrader Canvas Companion

A Manifest V3 browser extension that receives a graded assignment from
GridGrader and fills Canvas SpeedGrader's question-level score fields —
only after checking the displayed student and the question max-scores
match exactly. It never calls the Canvas API and never stores a Canvas
credential.

**Status: wired against real markup from one Canvas Classic Quizzes
SpeedGrader page (webcampus.unr.edu, essay-type questions), verified
against saved HTML fixtures — but not yet confirmed on a real, live
Canvas page end-to-end.** One thing still open, in "Before trusting this
on a real roster" below: whether other question types (multiple choice,
fill-in-blank, etc.) use the same markup shape. (Autosave is resolved —
Canvas doesn't autosave on blur; scores are committed by clicking the
real "Update Scores" button, which **Update Grades** now does for you as
part of the same action.)

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
3. Open the Canvas SpeedGrader page for that assignment, on any student.
4. Open this extension's popup, pick the student from the dropdown, and
   check the match status.
5. Only if it says **MATCH** — never on MISMATCH or UNDETECTED — click
   **Update Grades**. This fills the score fields *and* clicks Canvas's
   own **Update Scores** button in one action. The extension reports
   "fields filled" (and whether Update Scores was clicked), not "Canvas
   confirmed saved" — those are different claims (see `src/content/canvas.js`).
   On success, that student disappears from the dropdown (tracked as
   done) so you always know how many are left.
6. Click **Next ▶** to have the extension click Canvas's own next-student
   button for you. It then re-checks who Canvas is showing and, if that
   name exactly matches someone still left in the dropdown, auto-selects
   them — you still get to see MATCH/MISMATCH before doing anything, this
   just saves you re-opening the dropdown each time. **Prev ◀** works the
   same way backward. Neither button fills or sends anything by itself.
7. Confirm in Canvas periodically that the values look right — this
   automates the navigation and the two clicks, it doesn't remove the
   value of spot-checking, especially early on with a new quiz/course.

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
- Commits via the real `#update_scores button.update-scores` (a form
  submit), the same control a human grader would click. The preflight
  blocks up front — before touching any field — if this button isn't
  found, rather than leaving fields filled with nothing to commit them.

`src/shared/canvas-navigator.js`'s `RealCanvasNavigator` is a *separate*
adapter for a *separate* document — Canvas's top-frame student
prev/next buttons (`#prev-student-button` / `#next-student-button`),
confirmed from real markup the same way. It only ever clicks a
navigation button; it has no access to score data and can't fill or
send anything.

**Not** yet confirmed on an actual live Canvas page: only essay-type
questions have had their markup checked. If a question is
multiple-choice, fill-in-the-blank, etc., check its markup before
assuming `RealCanvasAdapter` covers it — it may not.

If markup differs from what's here, update the relevant adapter/navigator
(and the matching fixture under `test/fixtures/` to match) —
`canvas.js`'s preflight/send/navigate logic and the popup are written
against the adapter and navigator interfaces, not against Canvas markup
directly, so nothing else needs to change.

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

Three additional tests need a real browser (Playwright), which is why
they're kept separate from `npm test` rather than folded in:

```bash
node test/fixtures/run-fixture-test.js           # RealCanvasAdapter vs. canvas-quiz-page.html
node test/fixtures/run-navigator-fixture-test.js # RealCanvasNavigator vs. canvas-nav-page.html
node test/fixtures/run-popup-fixture-test.js     # popup.html/popup.js vs. a mocked chrome.* API
```

The first two run the actual adapter/navigator code — the same code that
runs against live Canvas — against saved HTML fixtures, checking
page-compatibility detection, student-name extraction, question
ordering/max-score extraction, that a score write actually lands and
fires the right events, that Update Scores actually gets clicked, and
that the nav buttons actually get clicked. The third loads the real
popup with `chrome.storage`/`chrome.tabs` mocked, and checks the parts a
pure-function test can't: rendering, the dropdown losing a student after
a successful send, the remaining-count text, and the navigate-then-
auto-select flow. None of these touch a real Canvas or GridGrader page;
they're the closest thing to that without one.

## Architecture

```
GridGrader page --postMessage--> GridGrader content script --validate--> chrome.storage.local
                                                                                |
                                                                                v
                                                                        Extension popup
                                                                          |          |
                                                    selected student + SEND_GRADES   |
                                                                          v          |  CLICK_NEXT/PREV_STUDENT
                                                              Canvas content script   |
                                                             (score iframe: preflight, v
                                                              fill, verify, commit)  Canvas content script
                                                                                    (top frame: nav only)
```

The score-entry markup and the student prev/next controls are two
**separate documents** in Canvas (an iframe and its parent top frame) —
that's why there are two adapters and two independently-gated message
listeners in `canvas.js`, not one. See the comments there and in
`canvas-navigator.js` for why.

- `src/shared/transfer-schema.js` — the exact same versioned contract as
  GridGrader's `lib/canvas-transfer/schema.ts`. Kept in sync by hand;
  there's no shared build between the two projects.
- `src/shared/normalize.js` — exact-match-only student name comparison.
- `src/shared/canvas-adapter.js` — isolates all Canvas-specific selectors
  for the score-entry iframe behind one interface (see above).
- `src/shared/canvas-navigator.js` — isolates the top-frame prev/next
  student controls behind a separate interface.
- `src/content/gridgrader.js` — listens on the GridGrader origin only,
  validates, writes to `chrome.storage.local`.
- `src/content/canvas.js` — preflight-then-write orchestration for
  scores, plus navigation orchestration, each independently gated on
  which document it's actually running in. Nothing is written unless
  every check passes first.
- `src/popup/` — status display, student picker (filtered to exclude
  already-sent students), match indicator, Update Grades / Prev / Next /
  Clear buttons, optional debug mode.

## Non-goals (by design) — and one deliberate exception

No Canvas API integration, no fuzzy name matching, no silent partial
sends, no automatic final submission. See the GridGrader repo's design
documents this extension was built from for the full rationale.

**Automatic roster traversal** (the Prev/Next buttons driving Canvas's
own navigation) was originally listed as a non-goal for MVP in that same
design doc. It's implemented anyway, at the explicit, informed request
of the person operating this extension — clicking Next never fills or
sends a grade by itself, it only moves to a different page and lets you
re-check MATCH there, so it doesn't weaken the actual safety guarantees
(student-identity check, max-score check, preflight-before-write) those
docs were protecting. Worth knowing if you're comparing this code back
against the original design docs and wondering why it's here.
