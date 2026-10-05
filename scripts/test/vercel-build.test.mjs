import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { spawnSync } from "node:child_process";

function run(env) {
  const dir = mkdtempSync(join(tmpdir(), "gridgrader-deploy-"));
  const log = join(dir, "calls");
  writeFileSync(join(dir, "npm"), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DEPLOY_TEST_LOG"\nif [ "$2" = "migrate:production" ]; then exit "${MIGRATION_EXIT:-0}"; fi\nexit "${BUILD_EXIT:-0}"\n', { mode: 0o755 });
  try {
    const result = spawnSync(process.execPath, ["scripts/vercel-build.mjs"], { encoding: "utf8", env: { ...process.env, PATH: dir + delimiter + process.env.PATH, DEPLOY_TEST_LOG: log, ...env } });
    let calls = [];
    try { calls = readFileSync(log, "utf8").trim().split("\n"); } catch { /* no commands executed */ }
    return { ...result, calls };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test("production migration completes before build", () => {
  const result = run({ VERCEL_ENV: "production", DATABASE_URL: "postgresql://local/test" });
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls, ["run migrate:production", "run build"]);
});
test("failed migration prevents building/promoting production", () => {
  const result = run({ VERCEL_ENV: "production", DATABASE_URL: "postgresql://local/test", MIGRATION_EXIT: "7" });
  assert.equal(result.status, 7);
  assert.deepEqual(result.calls, ["run migrate:production"]);
});
test("missing production database fails closed", () => {
  const result = run({ VERCEL_ENV: "production", DATABASE_URL: "" });
  assert.equal(result.status, 1);
  assert.deepEqual(result.calls, []);
});
test("preview builds never migrate a production database", () => {
  const result = run({ VERCEL_ENV: "preview" });
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls, ["run build"]);
});
test("build failure is propagated", () => {
  const result = run({ VERCEL_ENV: "production", DATABASE_URL: "postgresql://local/test", BUILD_EXIT: "8" });
  assert.equal(result.status, 8);
});
test("Vercel selects the guarded build entrypoint", () => {
  assert.equal(JSON.parse(readFileSync("vercel.json", "utf8")).buildCommand, "npm run build:vercel");
});
