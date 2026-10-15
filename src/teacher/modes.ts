import type { Control, Session } from "../firebase/types";

/** The teacher's phase, clamped to the applet's phases. */
export function teacherPhase(data: Session): number {
  const last = data.applet.manifest.phases.length - 1;
  return Math.max(0, Math.min(data.teacherState?.phase ?? 0, last));
}

/** Whether the applet offers Give. Only handoff: false in the manifest hides it. */
export const giveAllowed = (data: Session) =>
  data.applet.manifest.handoff !== false;

/**
 * What a slide's mode id does, including the ids of the old ten modes.
 * Spotlight needs a student, so its ids change nothing.
 */
export function slideMode(id: string): {
  [K in keyof Control]?: Control[K] | null;
} {
  if (id === "demo" || id === "reveal") return { mode: "demo", dark: null };
  if (id === "dark" || id === "freeze" || id === "focus") return { dark: true };
  if (id === "spotlight" || id === "anonymousSpotlight") return {};
  return { mode: "work", dark: null };
}
