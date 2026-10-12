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
      applet: { name: "a", html: "<p>", manifest: {} },
      control: { mode: "independent" },
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

  it("Freeze blocks state writes", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      set(ref(ctx.database(), `${S}/control/mode`), "freeze"),
    );
    await assertFails(set(ref(student(), `${S}/states/${STUDENT}`), state));
  });

  it("students cannot change control", async () => {
    await assertFails(
      update(ref(student(), `${S}/control`), { mode: "independent" }),
    );
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

  it("teachers form and rearrange groups", async () => {
    await assertSucceeds(
      update(ref(teacher(), S), {
        groups: {
          g1: { code: "AB23", members: { [STUDENT]: true }, count: 1 },
        },
        [`students/${STUDENT}/group`]: "g1",
      }),
    );
    await join(OTHER);
    await assertSucceeds(
      update(ref(teacher(), S), {
        [`groups/g1/members/${OTHER}`]: true,
        "groups/g1/count": 2,
        [`students/${OTHER}/group`]: "g1",
      }),
    );
    await assertFails(
      update(ref(teacher(), S), {
        "groups/g2": { members: { [OTHER]: true } },
      }),
    );
    await assertFails(
      set(ref(student(OTHER), `${S}/students/${STUDENT}/group`), null),
    );
  });

  it("teachers set control fields", async () => {
    await assertSucceeds(
      update(ref(teacher(), `${S}/control`), {
        mode: "gallery",
        gallery: { [STUDENT]: true },
        spotlight: STUDENT,
        pacedPhase: 1,
        reveal: state,
        groupSize: 3,
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

  it("only group members write group state", async () => {
    await assertSucceeds(
      set(ref(student(), `${S}/groups/g1`), {
        code: "QW",
        members: { [STUDENT]: true },
        count: 1,
      }),
    );
    await assertSucceeds(set(ref(student(), `${S}/groups/g1/state`), state));
    await assertSucceeds(
      set(ref(student(), `${S}/students/${STUDENT}/group`), "g1"),
    );
    await join(OTHER);
    await assertFails(set(ref(student(OTHER), `${S}/groups/g1/state`), state));
    await assertSucceeds(
      update(ref(student(OTHER), `${S}/groups/g1`), {
        [`members/${OTHER}`]: true,
        count: 2,
      }),
    );
    await assertSucceeds(
      set(ref(student(OTHER), `${S}/groups/g1/state`), state),
    );
  });

  describe("group membership", () => {
    const THIRD = "student3";
    const joinG = (uid: string, count: number) =>
      update(ref(student(uid), `${S}/groups/g1`), {
        [`members/${uid}`]: true,
        count,
      });

    beforeEach(async () => {
      await assertSucceeds(
        set(ref(student(), `${S}/groups/g1`), {
          code: "QW",
          members: { [STUDENT]: true },
          count: 1,
        }),
      );
      await join(OTHER);
      await join(THIRD);
    });

    it("groups cannot be created without a count", async () => {
      await assertFails(
        set(ref(student(OTHER), `${S}/groups/g2`), {
          code: "ZX",
          members: { [OTHER]: true },
        }),
      );
    });

    it("existing groups cannot be overwritten", async () => {
      await assertFails(
        set(ref(student(OTHER), `${S}/groups/g1`), {
          code: "QW",
          members: { [OTHER]: true },
          count: 1,
        }),
      );
    });

    it("joining must raise the count by one", async () => {
      await assertFails(
        set(ref(student(OTHER), `${S}/groups/g1/members/${OTHER}`), true),
      );
      await assertFails(joinG(OTHER, 1));
      await assertFails(joinG(OTHER, 3));
      await assertSucceeds(joinG(OTHER, 2));
    });

    it("the count moves only with your own membership", async () => {
      await assertFails(set(ref(student(OTHER), `${S}/groups/g1/count`), 0));
      await assertFails(
        update(ref(student(OTHER), `${S}/groups/g1`), {
          [`members/${THIRD}`]: true,
          count: 2,
        }),
      );
    });

    it("caps groups at the group size", async () => {
      await env.withSecurityRulesDisabled((ctx) =>
        set(ref(ctx.database(), `${S}/control/groupSize`), 2),
      );
      await assertSucceeds(joinG(OTHER, 2));
      await assertFails(joinG(THIRD, 3));
    });

    it("leaving lowers the count by one", async () => {
      await assertSucceeds(joinG(OTHER, 2));
      await assertFails(
        update(ref(student(OTHER), `${S}/groups/g1`), {
          [`members/${OTHER}`]: null,
          count: 2,
        }),
      );
      await assertSucceeds(
        update(ref(student(OTHER), `${S}/groups/g1`), {
          [`members/${OTHER}`]: null,
          count: 1,
        }),
      );
    });

    it("the teacher may exceed the group size", async () => {
      await env.withSecurityRulesDisabled((ctx) =>
        set(ref(ctx.database(), `${S}/control/groupSize`), 1),
      );
      await assertSucceeds(
        update(ref(teacher(), `${S}/groups/g1`), {
          [`members/${OTHER}`]: true,
          count: 2,
        }),
      );
    });

    it("the last member can leave", async () => {
      await assertSucceeds(
        update(ref(student(), `${S}/groups/g1`), {
          [`members/${STUDENT}`]: null,
          count: 0,
        }),
      );
    });

    it("groups cannot be created empty", async () => {
      await assertFails(
        set(ref(student(OTHER), `${S}/groups/g2`), { code: "ZX", count: 0 }),
      );
    });

    it("members over a shrunken cap can still leave", async () => {
      await assertSucceeds(joinG(OTHER, 2));
      await assertSucceeds(joinG(THIRD, 3));
      await env.withSecurityRulesDisabled((ctx) =>
        set(ref(ctx.database(), `${S}/control/groupSize`), 1),
      );
      await assertSucceeds(
        update(ref(student(THIRD), `${S}/groups/g1`), {
          [`members/${THIRD}`]: null,
          count: 2,
        }),
      );
    });
  });
});
