import { defineConfig } from "vitest/config";

// Run through `yarn test`, which starts the database emulator.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
