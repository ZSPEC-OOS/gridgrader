# GridGrader

Upload a spreadsheet of student responses, paste grading criteria for each
question, and let an AI model grade the class against that rubric.

## Workflow

1. **Grading** (`/`) — drag a `.xlsx`/`.csv` file onto the page. Column A is
   the student's name; every column after it is one question. The app shows
   a criteria box per detected question — paste the rubric / answer key for
   each, set a point value, and click **Save**.
2. Saved assignments appear in the list below with a **Grade** button.
3. Clicking **Grade** sends every student's answer, paired with that
   question's criteria, to the AI model configured on the **Settings**
   page, and stores a score + short feedback per answer.
4. Once grading finishes you're taken to the **Grid Grader** view — a
   spreadsheet-style grid (students × questions) with color-coded scores;
   click a cell to see the model's feedback.

## Stack

- Next.js (App Router) + TypeScript, deployed as a single Vercel app
- Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`) + PostgreSQL
- OpenAI API for grading (key + model configured on the Settings page, kept
  server-side)

Postgres, not SQLite, is required because grading runs across multiple
requests (save criteria → grade → view grid) that may land on different
serverless instances on Vercel; SQLite's local file wouldn't be shared or
durable there.

## Local development

Requires a Postgres database.

```bash
cp .env.example .env   # then set DATABASE_URL
npm install
npx prisma migrate dev
npm run dev
```

Run `npm test` to run the unit tests (grading prompt construction, settings
validation) — they don't require a database.

Open http://localhost:3000, then visit **Settings** to add an OpenAI API
key before using **Grade**.

## Deploying to Vercel

1. Provision a Postgres database (Vercel Postgres, Neon, Supabase, etc.)
   and set `DATABASE_URL` in the project's environment variables.
2. `vercel.json` selects `npm run build:vercel`. On production deployments
   (`VERCEL_ENV=production`), this runs `prisma migrate deploy` and aborts
   on failure **before** `next build`. Vercel only promotes the resulting
   deployment after the build succeeds, so new code never serves against
   the old integer column. Use a direct, migration-capable PostgreSQL URL
   with DDL privileges for `DATABASE_URL`. Do not use `prisma db push`.
   Preview deployments skip production migrations: use a separate preview
   database and apply `prisma migrate deploy` there before testing.
   For deployments outside Vercel, run `prisma migrate deploy` before
   starting/promoting the new application. The additive Float migration
   remains compatible with old integer-valued app instances.
3. Deploy the app to Vercel as usual. The AI model's API key is entered
   through the in-app Settings page (stored in the database) rather than
   as an environment variable, so it can be changed without a redeploy.

Grading loops over every student × question sequentially (5 requests in
flight at a time) inside one API route, so `app/api/assignments/[id]/grade/route.ts`
sets `maxDuration = 300`. For very large classes, raise this further or
move grading to a background job — it is currently a synchronous request.

## Known limitations (MVP)

- No real authentication yet. Settings has a PIN lock (set on first save;
  required to re-open the form for editing afterwards), but it's a UI-level
  guard — a hashed PIN, checked by a server endpoint — not an auth system.
  It stops casual browser access, not a direct API call.
- The OpenAI API key is stored in plaintext in the `Settings` table. Add
  auth and/or at-rest encryption before exposing this beyond trusted local
  use.
- Grading a very large roster in one request may exceed serverless time
  limits; see above.

## Fractional scores

Question maxima accept positive decimals. A decimal maximum does not enable
partial credit: a generic answer key permits only zero and full credit.
AI output and manual overrides use the same server-enforced allowed set.
Existing saved grades are preserved; new grading follows this rubric policy.

Write numeric directives as separate sentences, lines, or semicolon-separated
clauses, for example `1 point for X; 0.5 points for Y` for a 1.5-point question.
These independent allocations permit 0, 0.5, 1, and 1.5. `Award 0.5 points
for a partially correct answer` is a scoring level, not an additive component.
`1 point for each of three observations` permits three increments; repeated
allocations need an explicit count. Negations, deductions, quoted examples,
unnumbered partial/half credit, and ambiguous prose do not authorize amounts.
Alternative levels (if/when/or) are not added together. Unrecognized or overly
complex rubrics conservatively fall back to zero/full credit; check the allowed
values in the manual override menu. Expansion is capped at 64 components and
256 distinct scores.

Run `npm test`, `(cd extension && npm test)`, `npm run lint`, and
`npm run typecheck`. With a disposable migrated PostgreSQL database in
`DATABASE_URL`, run `npm run test:deployment` to test the migration and
deployment ordering. After `npm run build`, `npm run test:browser` runs
production UI/API regression scenarios and cleans up its synthetic assignments.
The browser suite requires Playwright resolvable by Node and Chromium installed;
set `CHROMIUM_EXECUTABLE_PATH` if using a system Chromium. It starts its own
loopback server on port 3101; use a test database, never production credentials.
