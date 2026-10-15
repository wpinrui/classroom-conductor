// The applet contract. See docs/applet-spec.md for the author-facing version.

/**
 * A prepared state as stored. json holds the state as JSON text, so any key and value survive the database.
 * Applets uploaded before that carry state as an object instead.
 */
export interface PreparedState {
  name: string;
  json?: string;
  state?: unknown;
  phase: number;
}

/** The prepared state's JSON text, from either stored shape. */
export const preparedJson = (p: PreparedState) =>
  p.json ?? JSON.stringify(p.state ?? null);

/** Declared by the applet in <script type="application/json" id="conductor-manifest">. */
export interface Manifest {
  title: string;
  phases: string[];
  /** Shapes the student chatbot. Absent switches the chatbot off. */
  instructions?: string;
  /** Tells the Engine what a Pulse reports. Absent switches the Pulse off. */
  pulsePrompt?: string;
  namelist?: string[];
  preparedStates?: PreparedState[];
  /** False hides Give. Anything else offers it. Named for the old Handoff button. */
  handoff?: boolean | number[];
  /** The teacher's slideshow script, stepped through with the scroll wheel. */
  slides?: Slide[];
}

/**
 * One slideshow step. Only label is required. A step with nothing else is a gap the teacher fills by hand.
 * Going back to a step re-applies it, except wheel and timer, which run only when stepping forward.
 */
export interface Slide {
  /** What the teacher sees as the next step. */
  label: string;
  /** The phase from this step on, until a later step names another. */
  phase?: number;
  /** The mode from this step on, until a later step names another or a reveal. */
  mode?: string;
  /** An applet action name, sent to the teacher's frame in a slide message. */
  cue?: string;
  /** Drives the name wheel like conductor.wheel. */
  wheel?: { filter?: string; spin?: boolean };
  /** Starts a countdown of this many seconds. */
  timer?: number;
  /** False shows the countdown to the teacher only. */
  timerShared?: boolean;
  /** Switches to Reveal showing the prepared state with this name. */
  reveal?: string;
}

/** A cue in a slide message. fresh is false for a replay, which must skip randomness and one-off effects. */
export interface SlideCue {
  name: string;
  fresh: boolean;
}

/** One student as the teacher's applet sees them. */
export interface ClassMember {
  name: string;
  phase: number;
  state: unknown;
  online: boolean;
}

/**
 * What surrounds the state a frame shows. role says whose state it is.
 * A student frame gets the teacher's live state. The teacher's own frame gets every student.
 */
export interface AppletContext {
  role: "teacher" | "student";
  teacher: { state: unknown; phase: number } | null;
  students: Record<string, ClassMember> | null;
}

/** A named set of students the teacher can spin the name wheel over. */
export interface WheelFilter {
  name: string;
  students: string[];
}

/** Options for conductor.wheel(options). Each field is optional and changes only what it names. */
export interface WheelOptions {
  /** true opens the wheel and false closes it. */
  open?: boolean;
  /** Filter name to select. An empty string selects the whole class. */
  filter?: string;
  /** false means a drawn student leaves the pool for the rest of the session. */
  replacement?: boolean;
  /** true opens the wheel and spins it. */
  spin?: boolean;
}

/** A teacher control the applet publishes for the remote. */
export interface AppletControl {
  id: string;
  label: string;
  kind: "button" | "toggle" | "text";
  /** A toggle's state or a text control's text. */
  value?: boolean | string;
  disabled?: boolean;
}

/** The control's well-formed shape, or null when it is malformed. */
export function toControl(v: unknown): AppletControl | null {
  const c = v as Partial<AppletControl>;
  if (typeof c !== "object" || c === null) return null;
  if (typeof c.id !== "string" || c.id.trim() === "") return null;
  if (typeof c.label !== "string" || c.label.trim() === "") return null;
  const kind = c.kind ?? "button";
  if (kind !== "button" && kind !== "toggle" && kind !== "text") return null;
  const out: AppletControl = { id: c.id, label: c.label, kind };
  if (kind === "toggle") out.value = c.value === true;
  if (kind === "text") out.value = typeof c.value === "string" ? c.value : "";
  if (c.disabled === true) out.disabled = true;
  return out;
}

/** Applet to host. */
export type AppletMessage =
  /** reset says whether the applet answers Reset. */
  | { cc: "connect"; reset?: boolean }
  | { cc: "update"; state: unknown; phase: number; seq: number }
  /** Replaces the filters the name wheel offers. Only the teacher's frame is heard. */
  | { cc: "filters"; filters: WheelFilter[] }
  /** Drives the name wheel with WheelOptions. Only the teacher's frame is heard. */
  | { cc: "wheel"; options: unknown }
  /** Spotlights a student, or ends the spotlight when student is null. Only the teacher's frame is heard. */
  | { cc: "spotlight"; student: unknown }
  /** The overlay shortcut, pressed while the applet has focus. */
  | { cc: "shortcut" }
  /** Replaces the teacher controls the remote shows. Only the teacher's frame is heard. */
  | { cc: "controls"; controls: unknown }
  /** A slideshow step key or wheel gesture inside the teacher's frame. */
  | { cc: "step"; dir: 1 | -1 }
  /** S pressed inside the teacher's frame. */
  | { cc: "slideshowToggle" }
  /** A projection hotkey pressed inside the applet, outside a text field, that the applet did not preventDefault. */
  | { cc: "hotkey"; key: string }
  /** Starts a countdown, or cancels it when seconds is null. Shared unless shared is false. Only the teacher's frame is heard. */
  | { cc: "timer"; seconds: number | null; shared: boolean };

/** Host to applet. maxPhase null lifts the limit. */
export type HostMessage =
  | { cc: "setState"; state: unknown; phase: number; seq: number }
  | { cc: "phaseLimit"; maxPhase: number | null }
  /** Go back to the fresh start of phase. Sent to a student's own live frame. */
  | { cc: "reset"; phase: number }
  | { cc: "context"; context: AppletContext }
  /** The name wheel landed on this student. Sent to the teacher's frame only. */
  | { cc: "wheelPicked"; student: string }
  /** Slideshow on or off. Sent to the teacher's frame only, and only when the applet has slides. */
  | { cc: "slideshow"; on: boolean }
  /** Move to phase and apply the cues in order. Sent to the teacher's frame only. */
  | { cc: "slide"; phase: number; cues: SlideCue[] }
  /** The teacher used one of the applet's controls on the remote. Sent to the teacher's frame only. */
  | { cc: "control"; id: string; value?: boolean | string };
