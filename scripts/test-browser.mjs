// Requires Playwright + Chromium, a migrated test database, and npm run build.
// Only creates synthetic assignments, which are deleted after the test.
import "dotenv/config";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const { chromium } = createRequire(import.meta.url)("playwright");
const port = 3101;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { stdio: "inherit" });
const ids = [];
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error("Test app exited before readiness");
    try { if ((await fetch(`${base}/api/assignments`)).ok) { ready = true; break; } } catch { /* starting */ }
    await delay(100);
  }
  assert.ok(ready, "production server must connect to PostgreSQL");
  browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {});
  const page = await browser.newPage();
  for (const scenario of [
    { criteria: "Correct answer is X", allowed: [0, 1.5], selected: 0 },
    { criteria: "1 point for X; 0.5 points for Y", allowed: [0, 0.5, 1, 1.5], selected: 0.5 },
    { criteria: "Partial credit allowed", allowed: [0, 1.5], selected: 1.5 },
    { criteria: "1 point for each of ten required elements", allowed: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], selected: 8, max: 10 },
  ]) {
    const max = scenario.max ?? 1.5;
    const form = new FormData();
    form.set("file", new Blob(["Name,X,Y\nSynthetic Student,X,Y\n"], { type: "text/csv" }), "fractional-smoke.csv");
    form.set("name", "Fractional regression test");
    form.set("criteria", JSON.stringify([{ header: "X", criteria: scenario.criteria, maxScore: max }, { header: "Y", criteria: "Y", maxScore: 0.25 }]));
    const saved = await fetch(`${base}/api/assignments`, { method: "POST", body: form });
    assert.equal(saved.status, 201, await saved.clone().text());
    const { id } = await saved.json();
    ids.push(id);
    let assignment = await (await fetch(`${base}/api/assignments/${id}`)).json();
    assert.equal(assignment.questions[0].maxScore, max);
    const answer = assignment.students[0].answers.find(a => a.questionId === assignment.questions[0].id);
    const rejected = await fetch(`${base}/api/assignments/${id}/grade`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answerId: answer.id, score: 0.75 }) });
    assert.equal(rejected.status, 400);
    await page.goto(`${base}/assignments/${id}/grid`);
    await page.getByRole("switch", { name: "Manual override" }).click();
    await page.getByRole("button", { name: "—", exact: true }).first().click();
    const select = page.locator("select");
    assert.deepEqual(await select.locator("option:not([disabled])").evaluateAll(options => options.map(o => Number(o.value))), scenario.allowed);
    const response = page.waitForResponse(r => r.url().endsWith(`/api/assignments/${id}/grade`) && r.request().method() === "PATCH");
    await select.selectOption(String(scenario.selected));
    assert.equal((await response).status(), 200);
    assignment = await (await fetch(`${base}/api/assignments/${id}`)).json();
    assert.equal(assignment.students[0].answers.find(a => a.id === answer.id).grade.score, scenario.selected);
    // Set second fractional grade through UI and verify total without rounding.
    await page.getByRole("button", { name: "—", exact: true }).click();
    const second = page.waitForResponse(r => r.url().endsWith(`/api/assignments/${id}/grade`) && r.request().method() === "PATCH");
    await page.locator("select").selectOption("0.25");
    assert.equal((await second).status(), 200);
    await page.getByRole("cell", { name: `${scenario.selected + 0.25} / ${max + 0.25}`, exact: true }).waitFor();
    await page.reload();
    await page.getByRole("cell", { name: `${scenario.selected + 0.25} / ${max + 0.25}`, exact: true }).waitFor();
    const updated = await fetch(`${base}/api/assignments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Fractional regression test", questions: [{ id: assignment.questions[0].id, criteria: scenario.criteria, maxScore: max + 0.125 }] }),
    });
    assert.equal(updated.status, 200);
    const edited = await (await fetch(`${base}/api/assignments/${id}`)).json();
    assert.equal(edited.questions[0].maxScore, max + 0.125);
    await page.goto(`${base}/assignments/${id}/edit`);
    assert.equal(await page.locator('input[type="number"]').first().inputValue(), String(max + 0.125));
  }
  console.log("Production browser grading: 4 scenarios passed (allowed options, rejection, persistence, integer compatibility, decimal totals).");
} finally {
  if (browser) await browser.close();
  for (const id of ids) {
    const result = await fetch(`${base}/api/assignments/${id}`, { method: "DELETE" });
    assert.ok(result.ok, "synthetic assignment cleanup");
  }
  server.kill("SIGTERM");
}
