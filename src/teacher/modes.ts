import type { Control, Mode, Session } from "../firebase/types";

/** Control fields a mode needs, filled in when it is first entered. */
export function defaultsFor(mode: Mode, data: Session): Partial<Control> {
  const c = data.control;
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
