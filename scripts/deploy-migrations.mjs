import pg from "pg";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const LEGACY_MIGRATIONS = [
  "20260907211042_init",
  "20260908023713_add_saved_models",
  "20260908024550_add_base_url",
  "20260908024824_add_settings_pin",
  "20260908034728_add_use_max_completion_tokens",
  "20260908181029_add_grading_tolerance",
  "20260909193000_replace_grading_tolerance_with_strictness_level",
];
function runPrisma(args) {
  const result = spawnSync("npm", ["exec", "--", "prisma", ...args], { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export async function deployMigrations({ databaseUrl = process.env.DATABASE_URL, run = runPrisma } = {}) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for production migrations.");
  const schema = new URL(databaseUrl).searchParams.get("schema") || "public";
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  let tables, history = [];
  try {
    tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = $1", [schema])).rows.map(row => row.tablename);
    if (tables.includes("_prisma_migrations")) {
      const identifier = pg.escapeIdentifier(schema);
      history = (await client.query(`SELECT migration_name, finished_at, rolled_back_at FROM ${identifier}."_prisma_migrations"`)).rows;
    }
  } finally { await client.end(); }

  const applied = new Set(history.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name));
  const missing = LEGACY_MIGRATIONS.filter(name => !applied.has(name));
  const onlyLegacyHistory = history.every(row => LEGACY_MIGRATIONS.includes(row.migration_name) && row.finished_at && !row.rolled_back_at);
  const nonempty = tables.some(name => name !== "_prisma_migrations");
  if (nonempty && missing.length && onlyLegacyHistory) {
    // Read-only comparison includes tables, columns, types, defaults, indexes
    // and constraints Prisma supports. Never mark missing DDL as applied.
    const diff = run(["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/baselines/pre-fractional.prisma", "--exit-code"]);
    if (diff === 0) {
      console.log("Existing schema matches the verified pre-fractional baseline. Recording existing migration history.");
      // An interrupted baseline can resume: reverify the schema and resolve
      // only the missing historical entries. Never baseline the Float change.
      for (const name of missing) {
        const result = run(["migrate", "resolve", "--applied", name]);
        if (result !== 0) return result;
      }
    } else if (history.length === 0 || diff !== 2) {
      throw new Error("Existing database does not match the verified baseline, or schema inspection failed. No migrations were marked applied. Inspect the schema before deploying.");
    }
    // With existing history and a differing schema, this can be a normal
    // partially migrated database. Let Prisma apply its pending migrations.
  }
  return run(["migrate", "deploy"]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  deployMigrations().then(code => { process.exitCode = code; }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
