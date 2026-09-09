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
2. Run `npx prisma migrate deploy` against that database (e.g. from CI, or
   locally with `DATABASE_URL` pointed at the prod database) before/while
   deploying.
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
