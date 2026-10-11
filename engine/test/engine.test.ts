import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { paths } from "../../src/firebase/paths.ts";
import { claudeCli } from "../src/claude.ts";
import { startEngine } from "../src/engine.ts";
import { CodeCache } from "../src/pulse.ts";

// Runs against the database emulator that `yarn test` starts.
const project = "demo-classroom-conductor";
const app = initializeApp(
  {
    projectId: project,
    databaseURL: `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${project}`,
  },
  "engine-test",
);
const db = getDatabase(app);
const fake = join(dirname(fileURLToPath(import.meta.url)), "fake-claude.mjs");
const cli = claudeCli({ command: `${process.execPath} ${fake}` });
let calls = 0;
const claude = (prompt: string) => {
  calls++;
  return cli(prompt);
};
const cache = new CodeCache();
let stop: () => void;

const S = "s1";
const manifest = {
  title: "Fractions",
  phases: ["Explore"],
  instructions: "Be brief.",
  pulsePrompt: "How many are done?",
};

const until = async (path: string, value: unknown) => {
  for (let i = 0; i < 100; i++) {
    if ((await db.ref(path).get()).val() === value) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`${path} never became ${String(value)}`);
};

beforeAll(() => {
  stop = startEngine({ db, claude, cache, log: () => {} });
});
afterAll(async () => {
  stop();
  await deleteApp(app);
});
beforeEach(async () => {
  await db.ref().set(null);
  await db.ref(paths.session(S)).set({
    teacher: "t",
    applet: { name: "Fractions", html: "<html>fractions</html>", manifest },
    control: { mode: "independent" },
  });
  await db.ref(paths.live(S)).set(true);
});

it("answers a pending chat request", async () => {
  await db
    .ref(paths.chat(S, "u1"))
    .push({ role: "user", text: "What is a half?", at: Date.now() });
  await db
    .ref(`${paths.requests(S)}/r1`)
    .set({ kind: "chat", student: "u1", at: Date.now(), status: "pending" });
  await until(`${paths.requests(S)}/r1/status`, "done");
  const chat = Object.values((await db.ref(paths.chat(S, "u1")).get()).val());
  expect(chat.at(-1)).toMatchObject({
    role: "assistant",
    text: "Echo: What is a half?",
  });
});

it("refuses chat over the limit", async () => {
  await db.ref(paths.control(S)).update({ chatLimit: 1 });
  const chat = db.ref(paths.chat(S, "u1"));
  await chat.push({ role: "user", text: "a", at: Date.now() });
  await chat.push({ role: "assistant", text: "b", at: Date.now() });
  await chat.push({ role: "user", text: "c", at: Date.now() });
  await db
    .ref(`${paths.requests(S)}/r1`)
    .set({ kind: "chat", student: "u1", at: Date.now(), status: "pending" });
  await until(`${paths.requests(S)}/r1/status`, "error");
});

it("produces a Pulse and reuses its code", async () => {
  const before = calls;
  for (const [id, input] of [
    ["p1", { done: 2, total: 5 }],
    ["p2", { done: 4, total: 5 }],
  ] as const) {
    await db
      .ref(paths.pulse(S, id))
      .set({ input: JSON.stringify(input), at: Date.now(), status: "pending" });
    await db
      .ref(`${paths.requests(S)}/${id}`)
      .set({ kind: "pulse", pulse: id, at: Date.now(), status: "pending" });
    await until(`${paths.pulse(S, id)}/status`, "done");
  }
  const pulses = (await db.ref(paths.pulses(S)).get()).val();
  expect(pulses.p1.output).toBe("<p>2 of 5</p>");
  expect(pulses.p2.output).toBe("<p>4 of 5</p>");
  expect(pulses.p2.code).toBe(pulses.p1.code);
  expect(calls - before).toBe(1);
});

it("marks a Pulse failed when its code cannot run", async () => {
  await db
    .ref(paths.pulse(S, "p3"))
    .set({ input: "not json", at: Date.now(), status: "pending" });
  await db
    .ref(`${paths.requests(S)}/p3`)
    .set({ kind: "pulse", pulse: "p3", at: Date.now(), status: "pending" });
  await until(`${paths.pulse(S, "p3")}/status`, "error");
});
