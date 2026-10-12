import { get, ref } from "firebase/database";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Manifest } from "../applet/contract";
import { trackPresence, unpackHtml } from "../firebase/client";
import { db } from "../firebase/config";
import { paths } from "../firebase/paths";
import type {
  ChatMessage,
  Control,
  Group,
  LibraryApplet,
  Pulse,
  Session,
  StoredState,
  Student,
} from "../firebase/types";
import { useValue } from "./useValue";

type Map<T> = Record<string, T>;

export const useLibrary = (teacher: string | null) =>
  useValue<Map<LibraryApplet>>(teacher && paths.applets(teacher));

/** The whole session. Teacher only: students cannot read the session root. */
export const useSession = (s: string) => useValue<Session>(paths.session(s));

export const useControl = (s: string) => useValue<Control>(paths.control(s));
export const useSessionApplet = (s: string) =>
  useValue<{ name: string; manifest: Manifest; html?: string }>(
    `${paths.session(s)}/applet`,
  );

const HTML_CACHE = "appletHtml";

/**
 * The session's applet page. Read once, never listened to, and remembered in this browser,
 * so reloads cost no download. legacy is the page from an older session that still stores it inline.
 */
export function useAppletHtml(
  session: string,
  legacy: string | undefined,
): string | undefined {
  const [found, setFound] = useState<{ session: string; html: string }>();
  useEffect(() => {
    let current = true;
    const done = (html: string) => current && setFound({ session, html });
    (async () => {
      if (legacy) return done(await unpackHtml(legacy));
      try {
        const cached = JSON.parse(localStorage.getItem(HTML_CACHE) ?? "null");
        if (cached?.session === session && typeof cached.html === "string")
          return done(cached.html);
      } catch {}
      const snap = await get(ref(db, paths.sessionHtml(session))).catch(
        () => null,
      );
      const raw = snap?.val();
      if (typeof raw !== "string") return;
      const html = await unpackHtml(raw);
      try {
        localStorage.setItem(HTML_CACHE, JSON.stringify({ session, html }));
      } catch {}
      done(html);
    })();
    return () => {
      current = false;
    };
  }, [session, legacy]);
  return found?.session === session ? found.html : undefined;
}
export const useTeacherState = (s: string) =>
  useValue<StoredState>(paths.teacherState(s));
export const useStudents = (s: string) =>
  useValue<Map<Student>>(paths.students(s));
export const usePresence = (s: string) =>
  useValue<Map<true>>(paths.presence(s));
export const useStates = (s: string) =>
  useValue<Map<StoredState>>(paths.states(s));
export const useStudentState = (s: string, uid: string | null) =>
  useValue<StoredState>(uid && paths.state(s, uid));
export const useGroups = (s: string) => useValue<Map<Group>>(paths.groups(s));
export const useGroup = (s: string, g: string | null | undefined) =>
  useValue<Group>(g ? paths.group(s, g) : null);
export const useChat = (s: string, uid: string | null) =>
  useValue<Map<ChatMessage>>(uid && paths.chat(s, uid));
export const usePulses = (s: string) => useValue<Map<Pulse>>(paths.pulses(s));

/** Keeps the signed-in user marked present in a session while mounted. */
export function usePresenceTracking(s: string | null) {
  useEffect(() => {
    if (!s) return;
    const stop = trackPresence(s);
    return () => {
      stop.then((f) => f());
    };
  }, [s]);
}

const WRITE_INTERVAL_MS = 150;

/** Throttles a state writer so fast-changing applets do not flood the database. */
export function useThrottledWriter(write: (state: StoredState) => unknown) {
  const pending = useRef<StoredState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeRef = useRef(write);
  writeRef.current = write;
  const flush = useCallback(() => {
    timer.current = null;
    if (pending.current) writeRef.current(pending.current);
    pending.current = null;
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      flush();
    },
    [flush],
  );
  return useCallback(
    (state: StoredState) => {
      pending.current = state;
      if (!timer.current) timer.current = setTimeout(flush, WRITE_INTERVAL_MS);
    },
    [flush],
  );
}
