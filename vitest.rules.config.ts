import { defineConfig } from "vitest/config";

// Security rules tests. Run through `yarn test:rules`, which starts the emulator.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
  },
});
