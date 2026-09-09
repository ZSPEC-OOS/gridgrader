import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // extension/ is a standalone, dependency-free plain-JS browser
    // extension (CommonJS require in its tests, `chrome`/`window`
    // globals) — it isn't part of this Next.js/TypeScript project and
    // has its own test runner; see extension/README.md.
    "extension/**",
  ]),
]);

export default eslintConfig;
