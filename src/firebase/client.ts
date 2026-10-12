import {
  GoogleAuthProvider,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  get,
  increment,
  onDisconnect,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import type { Manifest } from "../applet/contract";
import { nameKey, parseManifest } from "../applet/manifest";
import { auth, db, useEmulator } from "./config";
import { paths } from "./paths";
import type {
  ChatMessage,
  Control,
  EngineRequest,
  Group,
  JoinCode,
  LibraryApplet,
  Pulse,
  Session,
  StoredState,
  Student,
} from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

export function randomCode(length = JOIN_CODE_LENGTH): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    "",
  );
}

function uid(): string {
  const u = auth.currentUser?.uid;
  if (!u) throw new Error("Not signed in");
  return u;
}

/** Google sign-in. The emulator accepts an unsigned fake token, so dev needs no popup. */
export const signInTeacher = () =>
  useEmulator
    ? signInWithCredential(
        auth,
        GoogleAuthProvider.credential(
          JSON.stringify({ sub: "teacher", email: "teacher@example.com" }),
        ),
      )
    : signInWithPopup(auth, new GoogleAuthProvider());
export const signInStudent = () => signInAnonymously(auth);
export const signOutUser = () => signOut(auth);

// Library

export async function uploadApplet(html: string): Promise<string> {
  const manifest = parseManifest(html);
  const applet: LibraryApplet = {
    name: manifest.title,
    html,
    manifest,
    createdAt: Date.now(),
  };
  const r = push(ref(db, paths.applets(uid())));
  await set(r, applet);
  return r.key as string;
}

export const deleteApplet = (id: string) =>
  remove(ref(db, paths.applet(uid(), id)));

// Sessions

function namelistOf(manifest: Manifest): Record<string, string> | undefined {
  if (!manifest.namelist) return undefined;
  return Object.fromEntries(manifest.namelist.map((n) => [nameKey(n), n]));
}

/** Starts a session from a library applet and returns its id and join code. */
export async function startSession(
  appletId: string,
): Promise<{ session: string; code: string }> {
  const teacher = uid();
  const snap = await get(ref(db, paths.applet(teacher, appletId)));
  if (!snap.exists()) throw new Error("Applet not found");
  const applet = snap.val() as LibraryApplet;
  const session = push(ref(db, "sessions")).key as string;
  const namelist = namelistOf(applet.manifest);
  const data: Session = {
    teacher,
    code: "",
    createdAt: Date.now(),
    applet: { name: applet.name, html: applet.html, manifest: applet.manifest },
    ...(namelist ? { namelist } : {}),
    control: { mode: "demo" },
  };
  // Retry on the rare code collision: the codes rule refuses to overwrite.
  for (let attempt = 0; ; attempt++) {
    const code = randomCode();
    try {
      await set(ref(db, paths.code(code)), { teacher, session } as JoinCode);
    } catch (e) {
      if (attempt < 4) continue;
      throw e;
    }
    await set(ref(db, paths.session(session)), { ...data, code });
    await set(ref(db, paths.live(session)), true);
    return { session, code };
  }
}

export async function endSession(session: string, code: string) {
  await update(ref(db), {
    [`${paths.session(session)}/ended`]: Date.now(),
    [paths.live(session)]: null,
    [paths.code(code)]: null,
  });
}

/** Patches control. A null field is removed. */
export const setControl = (
  session: string,
  patch: { [K in keyof Control]?: Control[K] | null },
) => update(ref(db, paths.control(session)), patch);

/** Patches the name wheel settings. A path key such as `drawn/uid` touches one student. */
export const setWheel = (
  session: string,
  patch: Record<string, boolean | true | null>,
) => update(ref(db, paths.wheel(session)), patch);

export const writeTeacherState = (session: string, state: StoredState) =>
  set(ref(db, paths.teacherState(session)), state);

/** Writes one state onto every listed student in a single update. */
export function writeAllStates(
  session: string,
  students: string[],
  state: StoredState,
) {
  return update(
    ref(db),
    Object.fromEntries(students.map((s) => [paths.state(session, s), state])),
  );
}

/** Handoff: every student continues from the teacher's current state. */
export async function handoff(session: string, students: string[]) {
  const snap = await get(ref(db, paths.teacherState(session)));
  const updates: Record<string, unknown> = {
    [`${paths.control(session)}/mode`]: "independent",
  };
  if (snap.exists()) {
    const state = { ...(snap.val() as StoredState), at: Date.now() };
    for (const s of students) updates[paths.state(session, s)] = state;
  }
  return update(ref(db), updates);
}

/** Snapshots current states, of the class or one student, and queues a Pulse for the Engine. */
export async function requestPulse(
  session: string,
  student?: string,
): Promise<string> {
  const path = student ? paths.state(session, student) : paths.states(session);
  const snap = await get(ref(db, path));
  const states: Record<string, StoredState> = student
    ? snap.exists()
      ? { [student]: snap.val() }
      : {}
    : (snap.val() ?? {});
  const at = Date.now();
  const pulse: Pulse = {
    ...(student ? { student } : {}),
    input: JSON.stringify(states),
    at,
    status: "pending",
  };
  const pid = push(ref(db, paths.pulses(session))).key as string;
  const rid = push(ref(db, paths.requests(session))).key as string;
  const request: EngineRequest = {
    kind: "pulse",
    pulse: pid,
    at,
    status: "pending",
  };
  await update(ref(db), {
    [paths.pulse(session, pid)]: pulse,
    [`${paths.requests(session)}/${rid}`]: request,
  });
  return pid;
}

// Students

export class JoinError extends Error {
  constructor(readonly reason: "code" | "name") {
    super(reason === "code" ? "Unknown join code" : "Name not allowed");
  }
}

/** Joins a session by code. Rejoining with the same browser keeps the uid and so the work. */
export async function joinSession(
  rawCode: string,
  name: string,
): Promise<string> {
  if (!auth.currentUser) await signInStudent();
  const code = rawCode.trim().toUpperCase();
  const codeSnap = await get(ref(db, paths.code(code)));
  if (!codeSnap.exists()) throw new JoinError("code");
  const { session } = codeSnap.val() as JoinCode;
  const me = uid();
  const existing = await get(ref(db, paths.student(session, me))).catch(
    () => null,
  );
  if (!existing?.exists()) {
    const student: Student = {
      name: name.trim(),
      key: nameKey(name),
      joinedAt: Date.now(),
    };
    try {
      await set(ref(db, paths.student(session, me)), student);
    } catch {
      throw new JoinError("name");
    }
  }
  return session;
}

/** Marks the current user present until they disconnect. */
export async function trackPresence(session: string) {
  const r = ref(db, paths.presenceOf(session, uid()));
  await onDisconnect(r).remove();
  await set(r, true);
  return () => remove(r);
}

export const writeMyState = (session: string, state: StoredState) =>
  set(ref(db, paths.state(session, uid())), state);

export const writeGroupState = (
  session: string,
  group: string,
  state: StoredState,
) => set(ref(db, paths.groupState(session, group)), state);

export async function sendChat(session: string, text: string) {
  const me = uid();
  const message: ChatMessage = { role: "user", text, at: Date.now() };
  await push(ref(db, paths.chat(session, me)), message);
  await push(ref(db, paths.requests(session)), {
    kind: "chat",
    student: me,
    at: Date.now(),
    status: "pending",
  });
}

// Groups (teacher)

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const GROUP_CODE_LENGTH = 4;

/** Splits students into random groups of `size`, replacing every existing group. A lone leftover joins the last group. */
export function formGroups(session: string, students: string[], size: number) {
  const order = shuffle(students);
  const chunks: string[][] = [];
  for (let i = 0; i < order.length; i += size)
    chunks.push(order.slice(i, i + size));
  const last = chunks.at(-1);
  if (chunks.length > 1 && last && last.length === 1)
    chunks[chunks.length - 2].push(...(chunks.pop() as string[]));
  const groups: Record<string, Group> = {};
  const updates: Record<string, unknown> = {};
  for (const members of chunks) {
    const gid = push(ref(db, paths.groups(session))).key as string;
    groups[gid] = {
      code: randomCode(GROUP_CODE_LENGTH),
      members: Object.fromEntries(members.map((m) => [m, true])),
      count: members.length,
    };
    for (const m of members)
      updates[`${paths.student(session, m)}/group`] = gid;
  }
  updates[paths.groups(session)] = groups;
  return update(ref(db), updates);
}

/**
 * Moves a student into group `to`, or out of every group when `to` is null.
 * `to` "new" starts a fresh group. A group left empty is deleted.
 */
export function moveToGroup(
  session: string,
  student: string,
  from: (Group & { id: string }) | null,
  to: string | null,
) {
  const updates: Record<string, unknown> = {};
  if (from) {
    const left = Object.keys(from.members ?? {}).filter((m) => m !== student);
    if (left.length === 0) updates[paths.group(session, from.id)] = null;
    else {
      updates[`${paths.group(session, from.id)}/members/${student}`] = null;
      updates[`${paths.group(session, from.id)}/count`] = left.length;
    }
  }
  let target = to;
  if (to === "new") {
    target = push(ref(db, paths.groups(session))).key as string;
    updates[paths.group(session, target)] = {
      code: randomCode(GROUP_CODE_LENGTH),
      members: { [student]: true },
      count: 1,
    };
  } else if (to) {
    updates[`${paths.group(session, to)}/members/${student}`] = true;
    updates[`${paths.group(session, to)}/count`] = increment(1);
  }
  updates[`${paths.student(session, student)}/group`] = target;
  return update(ref(db), updates);
}
