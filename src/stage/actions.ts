import { useEffect, useRef } from "react";
import { setControl, setStage } from "../firebase/client";
import type { Session, Stage } from "../firebase/types";
import { isTextTarget, NEXT_KEYS, PREV_KEYS } from "../teacher/slides";

// What the remote and the projection's hotkeys ask of the projection. Each writes stage paths.

type Overlay = "blank" | "join" | "rules";

export const toggleOverlay = (session: string, stage: Stage, key: Overlay) =>
  setStage(session, { [key]: !stage[key] || null });

export const toggleWheel = (session: string, stage: Stage) =>
  setStage(session, { "wheel/open": !stage.wheel?.open || null });

/** Asks the projection to spin, opening the wheel if it is closed. */
export const spin = (session: string, stage: Stage) =>
  setStage(session, {
    "wheel/open": true,
    "wheel/spin": (stage.wheel?.spin ?? 0) + 1,
  });

/** True from a spin request until the projection reports where it landed. */
export const spinning = (stage: Stage) =>
  (stage.wheel?.spin ?? 0) > (stage.wheel?.result?.n ?? 0);

export const toggleSlideshow = (session: string, data: Session) => {
  if (!data.applet.manifest.slides?.length) return;
  setStage(session, { "slideshow/on": !data.stage?.slideshow?.on || null });
};

export const stepSlideshow = (session: string, stage: Stage, dir: 1 | -1) =>
  setStage(session, {
    "slideshow/step": { dir, n: (stage.slideshow?.step?.n ?? 0) + 1 },
  });

/** Passes a control use to the applet in the projection. */
export const sendControl = (
  session: string,
  stage: Stage,
  id: string,
  value?: boolean | string,
) =>
  setStage(session, {
    control: {
      id,
      ...(value === undefined ? {} : { value }),
      n: (stage.control?.n ?? 0) + 1,
    },
  });

/** Closes the join screen, rules and wheel on the projector, else leaves a spotlight. False when there was nothing to do. */
export function escapeStage(session: string, data: Session): boolean {
  const stage = data.stage ?? {};
  if (stage.join || stage.rules || stage.wheel?.open) {
    setStage(session, { join: null, rules: null, "wheel/open": null });
    return true;
  }
  if (!data.control.spotlight) return false;
  setControl(session, { spotlight: null });
  return true;
}

/**
 * The hotkeys the projection and the laptop remote share: W, B, J, R, S, the slideshow
 * step keys and Escape. extra runs first and returns true when it handled the key.
 */
export function useStageKeys(
  session: string,
  data: Session | null | undefined,
  extra?: (e: KeyboardEvent, data: Session) => boolean,
) {
  const latest = useRef({ data, extra });
  latest.current = { data, extra };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { data, extra } = latest.current;
      if (!data || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTextTarget(e.target)) return;
      if (hotkey(session, data, e.key, extra && (() => extra(e, data))))
        e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);
  return (key: string) => {
    const d = latest.current.data;
    if (d) hotkey(session, d, key);
  };
}

/** Applies one hotkey. Returns true when it did something. */
function hotkey(
  session: string,
  data: Session,
  key: string,
  extra?: () => boolean,
): boolean {
  const stage = data.stage ?? {};
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (stage.slideshow?.on && data.applet.manifest.slides?.length) {
    const dir = NEXT_KEYS.includes(key) ? 1 : PREV_KEYS.includes(key) ? -1 : 0;
    if (dir !== 0) {
      stepSlideshow(session, stage, dir);
      return true;
    }
  }
  if (extra?.()) return true;
  if (k === "w") toggleWheel(session, stage);
  else if (k === "b") toggleOverlay(session, stage, "blank");
  else if (k === "j") toggleOverlay(session, stage, "join");
  else if (k === "r") toggleOverlay(session, stage, "rules");
  else if (k === "s") toggleSlideshow(session, data);
  else if (k === "Escape" || k === "escape") return escapeStage(session, data);
  else return false;
  return true;
}

/** Spotlights a student over any mode. Null ends the spotlight. */
export function spotlightStudent(
  session: string,
  data: Session,
  uid: string | null,
) {
  if (uid === null) return setControl(session, { spotlight: null });
  if (!data.students?.[uid]) return;
  setControl(session, { spotlight: uid });
}
