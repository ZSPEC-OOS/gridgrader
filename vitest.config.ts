import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // extension/ is a standalone plain-JS project with its own test
    // runner (`node --test`, run via `npm test` inside extension/) — see
    // extension/README.md. It isn't part of this Vitest suite.
    exclude: ["**/node_modules/**", "extension/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
