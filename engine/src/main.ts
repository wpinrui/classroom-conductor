import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { claudeCli } from "./claude.ts";
import { startEngine } from "./engine.ts";
import { CodeCache } from "./pulse.ts";

const env = process.env;
const databaseURL = env.FIREBASE_DATABASE_URL;
if (!databaseURL)
  throw new Error("Set FIREBASE_DATABASE_URL. See engine/README.md.");

// The emulator accepts the Engine without a service account.
const app = initializeApp({
  databaseURL,
  ...(env.FIREBASE_DATABASE_EMULATOR_HOST
    ? {}
    : { credential: applicationDefault() }),
});

startEngine({
  db: getDatabase(app),
  claude: claudeCli({
    command: env.ENGINE_CLAUDE || "claude",
    model: env.ENGINE_MODEL,
  }),
  cache: new CodeCache(
    env.ENGINE_CACHE ||
      fileURLToPath(new URL("../.cache/pulse-code.json", import.meta.url)),
  ),
  concurrency: Number(env.ENGINE_CONCURRENCY) || 2,
});
console.log("Engine running. Press Ctrl+C to stop.");
