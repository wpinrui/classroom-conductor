import type { Control, Mode, Session } from "../firebase/types";

const SPOTLIGHTS: Mode[] = ["spotlight", "anonymousSpotlight"];

/** Control fields a mode needs, filled in when it is first entered. A null field is cleared. */
export function defaultsFor(
  mode: Mode,
  data: Session,
): { [K in keyof Control]?: Control[K] | null } {
  const c = data.control;
  // Spotlight starts with nobody on screen. The teacher picks who.
  if (SPOTLIGHTS.includes(mode) && !SPOTLIGHTS.includes(c.mode))
    return { spotlight: null };
  if (mode === "paced" && c.pacedPhase === undefined)
    return { pacedPhase: data.teacherState?.phase ?? 0 };
  if (mode === "reveal" && !c.reveal && data.teacherState)
    return { reveal: { ...data.teacherState, at: Date.now() } };
  return {};
}

/** The teacher's phase, clamped to the applet's phases. */
export function teacherPhase(data: Session): number {
  const last = data.applet.manifest.phases.length - 1;
  return Math.max(0, Math.min(data.teacherState?.phase ?? 0, last));
}

/** Modes the applet allows in the teacher's current phase. Null means every mode. */
export function allowedModes(data: Session): Mode[] | null {
  const modes = data.applet.manifest.modes;
  return modes?.[teacherPhase(data)] ?? null;
}

/** Whether the applet offers Handoff in the teacher's current phase. */
export function handoffAllowed(data: Session): boolean {
  const h = data.applet.manifest.handoff;
  if (Array.isArray(h)) return h.includes(teacherPhase(data));
  return h !== false;
}
