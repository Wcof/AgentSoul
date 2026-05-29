import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/tests/**/*.test.ts",
      "apps/*/tests/**/*.test.{ts,mjs}",
      "tests/v2/**/*.test.mjs",
    ],
    testTimeout: 30_000,
  },
});
