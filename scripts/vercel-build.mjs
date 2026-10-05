import { spawnSync } from "node:child_process";

function run(args) {
  const result = spawnSync("npm", args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Production migrations must succeed before building/promoting new code.
// Preview deployments must use their own database and never migrate prod.
if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required for production migrations.");
    process.exit(1);
  }
  run(["exec", "--", "prisma", "migrate", "deploy"]);
}
run(["run", "build"]);
