import {
  GoogleAuthProvider,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  get,
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
          JSON.stringify({
            sub: "teacher",
            email: "wongpinrui@gmail.com",
            email_verified: true,
          }),
        ),
      )
    : signInWithPopup(
        auth,
        new GoogleAuthProvider().setCustomParameters({
          prompt: "select_account",
        }),
      );
/** Teacher rights live in database.rules.json, so a readable library means the account is allowlisted. */
export const isTeacher = (u: string) =>
  get(ref(db, `teachers/${u}`)).then(
    () => true,
    () => false,
  );
export const signInStudent = () => signInAnonymously(auth);
export const signOutUser = () => signOut(auth);

// Library

/** Stored applet pages are gzip-compressed and base64-encoded behind this prefix. Older ones are plain HTML. */
const PACKED = "gz:";

export async function packHtml(html: string): Promise<string> {
  const stream = new Blob([html])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return PACKED + btoa(bin);
}

export async function unpackHtml(stored: string): Promise<string> {
  if (!stored.startsWith(PACKED)) return stored;
  const bytes = Uint8Array.from(atob(stored.slice(PACKED.length)), (c) =>
    c.charCodeAt(0),
  );
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** A short fingerprint of a page, so the Engine can key Pulse code without the page itself. */
async function fingerprint(html: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(html),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function uploadApplet(html: string): Promise<string> {
  const manifest = parseManifest(html);
  const applet: LibraryApplet = {
    name: manifest.title,
    manifest,
    createdAt: Date.now(),
  };
  const r = push(ref(db, paths.applets(uid())));
  const id = r.key as string;
  await set(ref(db, paths.libraryHtml(uid(), id)), await packHtml(html));
  await set(r, applet);
  return id;
}

export const deleteApplet = (id: string) =>
  update(ref(db), {
    [paths.applet(uid(), id)]: null,
    [paths.libraryHtml(uid(), id)]: null,
  });

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
  const stored = snap.val() as LibraryApplet;
  const html =
    stored.html ??
    (await unpackHtml(
      ((await get(ref(db, paths.libraryHtml(teacher, appletId)))).val() as
        | string
        | null) ?? "",
    ));
  if (!html) throw new Error("Applet page not found");
  // Re-read the manifest, so an applet saved by an older version of this app gains newer fields.
  const applet = { name: stored.name, manifest: parseManifest(html) };
  const session = push(ref(db, "sessions")).key as string;
  const namelist = namelistOf(applet.manifest);
  const data: Session = {
    teacher,
    code: "",
    createdAt: Date.now(),
    applet: {
      name: applet.name,
      manifest: applet.manifest,
      hash: await fingerprint(html),
    },
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
    await set(ref(db, paths.sessionHtml(session)), await packHtml(html));
    await set(ref(db, paths.live(session)), true);
    await set(ref(db, paths.current(teacher)), session);
    return { session, code };
  }
}

export async function endSession(session: string, code: string) {
  await update(ref(db), {
    [`${paths.session(session)}/ended`]: Date.now(),
    [paths.live(session)]: null,
    [paths.code(code)]: null,
    [paths.current(uid())]: null,
  });
}

/** Patches what the projection shows. Keys may be paths such as `wheel/open`. A null field is removed. */
export const setStage = (session: string, patch: Record<string, unknown>) =>
  update(ref(db, paths.stage(session)), patch);

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

/**
 * Give: every student continues from what is on screen, then works on it.
 * That is the spotlighted student's state during a spotlight, else the teacher's.
 */
export async function give(session: string, data: Session) {
  const source = data.control.spotlight;
  const snap = await get(
    ref(
      db,
      source ? paths.state(session, source) : paths.teacherState(session),
    ),
  );
  const updates: Record<string, unknown> = {
    [`${paths.control(session)}/mode`]: "work",
    [`${paths.control(session)}/spotlight`]: null,
  };
  if (snap.exists()) {
    const { json, phase } = snap.val() as StoredState;
    // Marked as answering the last Reset, so the given state is not reset away.
    const state: StoredState = {
      json,
      phase,
      at: Date.now(),
      ...(data.control.reset ? { reset: data.control.reset } : {}),
    };
    for (const s of Object.keys(data.students ?? {}))
      if (s !== source) updates[paths.state(session, s)] = state;
  }
  return update(ref(db), updates);
}

/** Reset: every student's own applet goes back to the fresh start of its phase. */
export const resetAll = (session: string) =>
  setControl(session, { reset: Date.now() });

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
  try {
    localStorage.setItem(LAST_JOIN, JSON.stringify({ code, session }));
  } catch {}
  return session;
}

const LAST_JOIN = "lastJoin";

/** The session this browser last joined, if it is still running and this student is still in it. */
export async function resumeSession(): Promise<string | null> {
  let last: { code?: unknown; session?: unknown };
  try {
    last = JSON.parse(localStorage.getItem(LAST_JOIN) ?? "null") ?? {};
  } catch {
    return null;
  }
  const { code, session } = last;
  if (typeof code !== "string" || typeof session !== "string") return null;
  await auth.authStateReady();
  if (!auth.currentUser) return null;
  const codeSnap = await get(ref(db, paths.code(code))).catch(() => null);
  if ((codeSnap?.val() as JoinCode | null)?.session !== session) return null;
  const me = await get(ref(db, paths.student(session, uid()))).catch(
    () => null,
  );
  return me?.exists() ? session : null;
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

/** The teacher writing a student's state, such as while working on it in a spotlight. */
export const writeStudentState = (
  session: string,
  student: string,
  state: StoredState,
) => set(ref(db, paths.state(session, student)), state);

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
