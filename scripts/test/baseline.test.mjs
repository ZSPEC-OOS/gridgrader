import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";

async function invoke(databaseUrl, args = ["scripts/deploy-migrations.mjs"], executable = process.execPath) {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    child.on("error", reject);
    child.on("exit", code => resolve({ code, output }));
  });
}
async function withSchema(fn) {
  assert.ok(process.env.DATABASE_URL, "Test PostgreSQL DATABASE_URL required");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const schema = `baseline_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const quoted = pg.escapeIdentifier(schema);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("schema", schema);
  try {
    await client.query(`CREATE SCHEMA ${quoted}`);
    await client.query(`SET search_path TO ${quoted}`);
    await fn(client, url.toString());
  } finally {
    await client.query(`DROP SCHEMA ${quoted} CASCADE`);
    await client.end();
  }
}
async function legacySchema(client) {
  const names = (await readdir("prisma/migrations")).filter(name => /^\d/.test(name) && !name.includes("fractional")).sort();
  for (const name of names) await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
  await client.query(`INSERT INTO "Assignment" (id, name, "sourceFile", "updatedAt") VALUES ('keep', 'Existing assignment', 'keep.csv', NOW())`);
  await client.query(`INSERT INTO "Question" (id, "assignmentId", index, header, "maxScore") VALUES ('keep-q', 'keep', 0, 'Existing question', 2)`);
}

test("P3005 legacy database is verified, baselined, migrated, preserves data and can redeploy", async () => {
  await withSchema(async (client, url) => {
    await legacySchema(client);
    const result = await invoke(url);
    assert.equal(result.code, 0, result.output);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')).rows[0].n, 8);
    assert.equal((await client.query('SELECT "maxScore" FROM "Question" WHERE id=\'keep-q\'')).rows[0].maxScore, 2);
    await client.query('UPDATE "Question" SET "maxScore"=1.5 WHERE id=\'keep-q\'');
    assert.equal((await client.query('SELECT "maxScore" FROM "Question" WHERE id=\'keep-q\'')).rows[0].maxScore, 1.5);
    const repeat = await invoke(url);
    assert.equal(repeat.code, 0, repeat.output);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM "Assignment"')).rows[0].n, 1);
  });
});
test("untracked schema drift fails closed without recording migrations or changing data", async () => {
  await withSchema(async (client, url) => {
    await legacySchema(client);
    await client.query('ALTER TABLE "Settings" DROP COLUMN "gradingStrictnessLevel"');
    const result = await invoke(url);
    assert.notEqual(result.code, 0);
    assert.match(result.output, /No migrations were marked applied/);
    assert.equal((await client.query("SELECT to_regclass(current_schema() || '.\"_prisma_migrations\"') AS history")).rows[0].history, null);
    assert.equal((await client.query('SELECT "maxScore" FROM "Question"')).rows[0].maxScore, 2);
  });
});
test("fresh database uses ordinary deploy without baselining", async () => {
  await withSchema(async (client, url) => {
    const result = await invoke(url);
    assert.equal(result.code, 0, result.output);
    assert.doesNotMatch(result.output, /Recording existing migration history/);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM "_prisma_migrations"')).rows[0].n, 8);
  });
});

test("interrupted baseline resumes only after rechecking the existing schema", async () => {
  await withSchema(async (client, url) => {
    await legacySchema(client);
    const first = await invoke(url, ["exec", "--", "prisma", "migrate", "resolve", "--applied", "20260907211042_init"], "npm");
    assert.equal(first.code, 0, first.output);
    const result = await invoke(url);
    assert.equal(result.code, 0, result.output);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')).rows[0].n, 8);
    assert.equal((await client.query('SELECT "maxScore" FROM "Question"')).rows[0].maxScore, 2);
  });
});
