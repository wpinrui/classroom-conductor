import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { get, ref, set, update } from "firebase/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

const TEACHER = "teacher1";
const STUDENT = "student1";
const OTHER = "student2";
const SID = "s1";
const S = `sessions/${SID}`;
const state = { json: "{}", phase: 0, at: 1 };

const teacher = () =>
  env
    .authenticatedContext(TEACHER, {
      firebase: { sign_in_provider: "google.com" },
      email: "wongpinrui@gmail.com",
      email_verified: true,
    })
    .database();
const stranger = () =>
  env
    .authenticatedContext("stranger", {
      firebase: { sign_in_provider: "google.com" },
      email: "someone@gmail.com",
      email_verified: true,
    })
    .database();
const student = (uid = STUDENT) =>
  env
    .authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } })
    .database();
const joined = (name = "Ann", key = "ann") => ({ name, key, joinedAt: 1 });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-classroom-conductor",
    database: {
      rules: readFileSync("database.rules.json", "utf8"),
      host: "127.0.0.1",
      port: 9000,
    },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), S), {
      teacher: TEACHER,
      code: "ABC234",
      createdAt: 1,
      applet: {
        name: "a",
        html: "<p>",
        manifest: { instructions: "Be kind." },
      },
      control: { mode: "work" },
    });
    await set(ref(ctx.database(), "codes/ABC234"), {
      teacher: TEACHER,
      session: SID,
    });
  });
});

async function join(uid = STUDENT) {
  await assertSucceeds(
    set(ref(student(uid), `${S}/students/${uid}`), joined()),
  );
}

describe("teachers", () => {
  it("own their library", async () => {
    await assertSucceeds(
      set(ref(teacher(), `teachers/${TEACHER}/applets/x`), { name: "a" }),
    );
    await assertFails(get(ref(student(), `teachers/${TEACHER}`)));
  });

  it("anonymous users cannot start sessions", async () => {
    await assertFails(
      set(ref(student(), "sessions/s2"), { teacher: STUDENT, code: "X" }),
    );
    await assertSucceeds(
      set(ref(teacher(), "sessions/s2"), { teacher: TEACHER, code: "X" }),
    );
  });

  it("only allowlisted Google accounts can teach", async () => {
    await assertFails(
      set(ref(stranger(), "sessions/s3"), { teacher: "stranger", code: "X" }),
    );
    await assertFails(
      set(ref(stranger(), "codes/NEW234"), {
        teacher: "stranger",
        session: "s3",
      }),
    );
    await assertFails(
      set(ref(stranger(), "teachers/stranger/applets/x"), { name: "a" }),
    );
  });

  it("codes cannot be overwritten", async () => {
    await assertFails(
      set(ref(teacher(), "codes/ABC234"), { teacher: TEACHER, session: "s9" }),
    );
    await assertSucceeds(
      set(ref(teacher(), "codes/NEW234"), { teacher: TEACHER, session: "s9" }),
    );
  });
});

describe("joining", () => {
  it("anyone signed in can resolve a code", async () => {
    await assertSucceeds(get(ref(student(), "codes/ABC234")));
    await assertFails(get(ref(student(), "codes")));
  });

  it("students cannot read a session before joining", async () => {
    await assertFails(get(ref(student(), `${S}/control`)));
    await join();
    await assertSucceeds(get(ref(student(), `${S}/control`)));
    await assertSucceeds(get(ref(student(), `${S}/applet`)));
    await assertFails(get(ref(student(), S)));
  });

  it("enforces the namelist", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      set(ref(ctx.database(), `${S}/namelist`), { ann: "Ann" }),
    );
    await assertFails(
      set(ref(student(OTHER), `${S}/students/${OTHER}`), joined("Bob", "bob")),
    );
    await join();
  });

  it("refuses joins after the session ends", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      set(ref(ctx.database(), `${S}/ended`), 5),
    );
    await assertFails(
      set(ref(student(), `${S}/students/${STUDENT}`), joined()),
    );
  });

  it("students cannot write as someone else", async () => {
    await assertFails(set(ref(student(), `${S}/students/${OTHER}`), joined()));
  });
});

describe("student work", () => {
  beforeEach(() => join());

  it("students write only their own state", async () => {
    await assertSucceeds(set(ref(student(), `${S}/states/${STUDENT}`), state));
    await assertFails(set(ref(student(), `${S}/states/${OTHER}`), state));
  });

  it("students cannot change control", async () => {
    await assertFails(update(ref(student(), `${S}/control`), { mode: "work" }));
  });

  it("chat is private and requests are chat only", async () => {
    await assertSucceeds(
      set(ref(student(), `${S}/chat/${STUDENT}/m1`), {
        role: "user",
        text: "hi",
        at: 1,
      }),
    );
    await assertFails(
      set(ref(student(), `${S}/chat/${STUDENT}/m2`), {
        role: "assistant",
        text: "hi",
        at: 1,
      }),
    );
    await assertSucceeds(
      set(ref(student(), `${S}/requests/r1`), {
        kind: "chat",
        student: STUDENT,
        at: 1,
        status: "pending",
      }),
    );
    await assertFails(
      set(ref(student(), `${S}/requests/r2`), {
        kind: "pulse",
        pulse: "p",
        at: 1,
        status: "pending",
      }),
    );
    await assertFails(get(ref(student(), `${S}/pulses`)));
  });

  it("teachers chat with the Engine in their own thread", async () => {
    await assertSucceeds(
      set(ref(teacher(), `${S}/chat/${TEACHER}/m1`), {
        role: "user",
        text: "hi",
        at: 1,
      }),
    );
    await assertSucceeds(
      set(ref(teacher(), `${S}/requests/r1`), {
        kind: "chat",
        student: TEACHER,
        at: 1,
        status: "pending",
      }),
    );
    await assertSucceeds(get(ref(teacher(), `${S}/chat/${TEACHER}`)));
    await assertFails(get(ref(student(), `${S}/chat/${TEACHER}`)));
  });

  it("teachers request Pulses and students cannot", async () => {
    const pulse = { input: "{}", at: 1, status: "pending" };
    const request = { kind: "pulse", pulse: "p1", at: 1, status: "pending" };
    await assertSucceeds(
      update(ref(teacher(), S), {
        "pulses/p1": pulse,
        "requests/r1": request,
      }),
    );
    await assertSucceeds(get(ref(teacher(), `${S}/pulses/p1`)));
    await assertFails(set(ref(student(), `${S}/pulses/p2`), pulse));
  });

  it("teachers write student states, as Give and a spotlight do", async () => {
    await assertSucceeds(set(ref(teacher(), `${S}/states/${STUDENT}`), state));
  });

  it("teachers set control fields", async () => {
    await assertSucceeds(
      update(ref(teacher(), `${S}/control`), {
        mode: "work",
        spotlight: STUDENT,
        dark: true,
        reset: 5,
        chatLimit: 0,
      }),
    );
    await assertSucceeds(
      update(ref(teacher(), `${S}/control`), { chatLimit: null }),
    );
  });

  it("teachers set timers and only shared ones reach students", async () => {
    await assertSucceeds(
      update(ref(teacher(), S), {
        "control/timer": { endsAt: 5 },
        teacherTimer: { left: 60000 },
      }),
    );
    await assertSucceeds(get(ref(student(), `${S}/control/timer`)));
    await assertFails(get(ref(student(), `${S}/teacherTimer`)));
    await assertFails(set(ref(student(), `${S}/control/timer`), { endsAt: 9 }));
    await assertFails(
      set(ref(teacher(), `${S}/control/timer`), { endsAt: 5, left: 1 }),
    );
    await assertFails(set(ref(teacher(), `${S}/teacherTimer`), { left: -1 }));
    await assertFails(
      set(ref(teacher(), `${S}/teacherTimer`), { endsAt: "soon" }),
    );
  });
});
