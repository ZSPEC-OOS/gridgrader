# GridGrader Canvas Companion

A Manifest V3 browser extension that receives a graded assignment from
GridGrader and fills Canvas SpeedGrader's question-level score fields —
only after checking the displayed student and the question max-scores
match exactly. It never calls the Canvas API and never stores a Canvas
credential.

**Status: the GridGrader-receiving half is fully functional. The
Canvas-writing half is not yet wired to real Canvas selectors** — see
"Before this can write real grades" below. Until that's done,
`isCompatiblePage()` always returns `false`, so the popup will correctly
refuse to send on every page rather than risk a wrong write.

## Install (no build step)

1. Edit `manifest.json`: replace both placeholder domains —
   `https://YOUR-GRIDGRADER-DOMAIN/*` with your actual deployed GridGrader
   origin, and `https://YOUR-SCHOOL.instructure.com/*` with your Canvas
   institution's domain — in both `host_permissions` and `content_scripts`.
2. In Chrome or Edge, go to `chrome://extensions`, enable **Developer
   mode**, click **Load unpacked**, and select this `extension/` folder.
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

## Before this can write real grades

Canvas's SpeedGrader DOM varies by institution, quiz type, and release,
so `src/shared/canvas-adapter.js` intentionally ships as a stub that
refuses every page. To finish it, open your actual Canvas grading page's
dev tools and capture:

1. The `<input>` for one question-level score box.
2. Its enclosing question-container HTML (or a stable class/data attribute).
3. The element showing the currently displayed student's name.
4. The element/text showing that question's maximum points.
5. Whether entering a score and blurring auto-saves in Canvas, or needs
   another action.

Then implement a real adapter object (same shape as
`NotImplementedCanvasAdapter` in `canvas-adapter.js`) and point
`ACTIVE_ADAPTER` at it. Nothing else in the extension needs to change —
`canvas.js`'s preflight/send logic and the popup are already written
against the adapter interface, not against Canvas markup directly.

## Running the tests

```bash
npm test
```

(Just `node --test test/*.test.js` under the hood — no dependencies to
install. This is a dev convenience; end users never need to run it.)
Covers: transfer-package schema validation, the GridGrader receiver's
origin/source/type filtering, student-name normalization, and the
preflight logic proving zero DOM writes occur on any blocking mismatch
(wrong page, undetected/mismatched student, question-count or max-score
mismatch, null score, non-editable input) — all against a fake adapter,
since none of that needs a real Canvas page. The real adapter, once
written, needs its own fixture-based tests against saved Canvas HTML.

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
