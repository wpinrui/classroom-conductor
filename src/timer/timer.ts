import { onValue, ref, update } from "firebase/database";
import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { paths } from "../firebase/paths";
import type { Timer } from "../firebase/types";

const MINUTE = 60_000;
const TICK_MS = 250;

let offset = 0;
onValue(ref(db, ".info/serverTimeOffset"), (snap) => {
  offset = snap.val() ?? 0;
});

/** This device's clock corrected to server time, so every screen agrees. */
export const serverNow = () => Date.now() + offset;

/** Server time, re-rendering every tick while active. */
export function useServerNow(active: boolean): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(t);
  }, [active]);
  return serverNow();
}

/** Milliseconds left, never below zero. */
export const remaining = (t: Timer, now: number) =>
  Math.max(0, t.left ?? (t.endsAt ?? now) - now);

/** m:ss, or h:mm:ss from an hour up. Rounds up so 0:00 means done. */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Whole minutes left, rounded down. */
export const minutes = (ms: number) => Math.floor(ms / MINUTE);

/** Reads "5", "2.5" or "2:30" as a duration in ms. Null when unreadable or zero. */
export function parseDuration(text: string): number | null {
  const m = text.trim().match(/^(\d{1,3})(?::([0-5]\d))?$|^(\d*\.\d+)$/);
  if (!m) return null;
  const ms = m[3]
    ? Number(m[3]) * MINUTE
    : Number(m[1]) * MINUTE + Number(m[2] ?? 0) * 1000;
  return ms > 0 ? ms : null;
}

export const start = (ms: number, now: number): Timer => ({ endsAt: now + ms });
export const pause = (t: Timer, now: number): Timer => ({
  left: remaining(t, now),
});
export const resume = (t: Timer, now: number): Timer =>
  start(remaining(t, now), now);
/** Adds a minute. A finished timer restarts from now. */
export const addMinute = (t: Timer, now: number): Timer =>
  t.left !== undefined
    ? { left: t.left + MINUTE }
    : start(remaining(t, now) + MINUTE, now);

/** Writes the timer where its audience can read it, clearing the other spot. Null cancels. */
export const setTimer = (
  session: string,
  timer: Timer | null,
  shared: boolean,
) =>
  update(ref(db), {
    [paths.timer(session)]: shared ? timer : null,
    [paths.teacherTimer(session)]: shared ? null : timer,
  });

const MAX_SECONDS = 24 * 3600;

/** Applies a timer an applet scripted. Null seconds cancels. Shared unless shared is false. */
export function scriptTimer(
  session: string,
  seconds: unknown,
  shared: unknown,
) {
  const share = shared !== false;
  if (seconds === null) return setTimer(session, null, share);
  if (typeof seconds !== "number" || !(seconds > 0) || seconds > MAX_SECONDS)
    return;
  return setTimer(session, start(seconds * 1000, serverNow()), share);
}
