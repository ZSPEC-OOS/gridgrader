import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

test("INTEGER to DOUBLE PRECISION preserves every int32 boundary, default, null constraint and fractional values", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for the real PostgreSQL migration test");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    // Temp table shadows any real Question table; rollback leaves no changes.
    await client.query('CREATE TEMP TABLE "Question" ("id" SERIAL PRIMARY KEY, "maxScore" INTEGER NOT NULL DEFAULT 10)');
    const legacy = [-2147483648, 0, 1, 10, 2147483647];
    for (const value of legacy) await client.query('INSERT INTO "Question" ("maxScore") VALUES ($1)', [value]);
    const sql = await readFile(new URL("../../prisma/migrations/20261005194500_fractional_question_scores/migration.sql", import.meta.url), "utf8");
    await client.query(sql);
    const rows = await client.query('SELECT "maxScore" FROM "Question" ORDER BY "id"');
    assert.deepEqual(rows.rows.map(row => row.maxScore), legacy);
    const type = await client.query('SELECT pg_typeof("maxScore")::text AS type FROM "Question" LIMIT 1');
    assert.equal(type.rows[0].type, "double precision");
    assert.equal((await client.query('INSERT INTO "Question" DEFAULT VALUES RETURNING "maxScore"')).rows[0].maxScore, 10);
    assert.equal((await client.query('INSERT INTO "Question" ("maxScore") VALUES (1.5) RETURNING "maxScore"')).rows[0].maxScore, 1.5);
    await assert.rejects(client.query('INSERT INTO "Question" ("maxScore") VALUES (NULL)'), /not-null constraint/);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
