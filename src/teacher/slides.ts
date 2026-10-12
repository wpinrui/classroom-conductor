import type { Slide, SlideCue } from "../applet/contract";
import type { Mode } from "../firebase/types";

/** What a step leaves in force: the last phase, and the last mode or reveal, declared at or before it. */
export interface SlideEffect {
  phase?: number;
  mode?: Mode;
  /** Prepared state name, when the mode comes from a reveal step. */
  reveal?: string;
}

export function slideEffect(slides: Slide[], k: number): SlideEffect {
  const out: SlideEffect = {};
  for (let j = 0; j <= k; j++) {
    const s = slides[j];
    if (s.phase !== undefined) out.phase = s.phase;
    if (s.reveal !== undefined) {
      out.mode = "reveal";
      out.reveal = s.reveal;
    } else if (s.mode !== undefined) {
      out.mode = s.mode;
      out.reveal = undefined;
    }
  }
  return out;
}

/**
 * The cues that rebuild step k: every cue from the start of k's phase run up to k, in order.
 * The last is fresh only when stepping forward onto a step that has a cue itself.
 */
export function slideCues(
  slides: Slide[],
  k: number,
  forward: boolean,
): SlideCue[] {
  const phase = slideEffect(slides, k).phase;
  let from = k;
  while (from > 0 && slideEffect(slides, from - 1).phase === phase) from--;
  const cues: SlideCue[] = [];
  for (let j = from; j <= k; j++) {
    const cue = slides[j].cue;
    if (cue !== undefined) cues.push({ name: cue, fresh: false });
  }
  if (forward && slides[k].cue !== undefined)
    cues[cues.length - 1].fresh = true;
  return cues;
}

/** Wheel deltas this small are trackpad noise. */
const MIN_DELTA = 4;
/** A gesture ends after this long without a wheel event. */
const GESTURE_GAP_MS = 250;

/** One step per wheel gesture, so trackpad inertia never skips steps. Returns the direction to step, or 0. */
export function wheelGesture(): (e: WheelEvent) => 0 | 1 | -1 {
  let last = 0;
  let armed = true;
  return (e) => {
    const now = Date.now();
    if (now - last >= GESTURE_GAP_MS) armed = true;
    last = now;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1;
    const dy = e.deltaY * unit;
    if (!armed || Math.abs(dy) < MIN_DELTA) return 0;
    armed = false;
    return dy > 0 ? 1 : -1;
  };
}

/** True when keys belong to a text field rather than the page. */
export function isTextTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return (
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable ||
    t.closest('[role="textbox"]') !== null
  );
}

export const NEXT_KEYS = ["PageDown", "ArrowDown", " "];
export const PREV_KEYS = ["PageUp", "ArrowUp"];

const storeKey = (session: string) => `slideshow:${session}`;

/** The saved cursor for this session, or -1 before the first step. */
export function loadCursor(session: string): number {
  try {
    const raw = localStorage.getItem(storeKey(session));
    const n = raw === null ? -1 : Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : -1;
  } catch {
    return -1;
  }
}

export function saveCursor(session: string, cursor: number) {
  try {
    localStorage.setItem(storeKey(session), String(cursor));
  } catch {
    // Storage blocked: the cursor lasts until reload.
  }
}
