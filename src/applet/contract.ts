// The applet contract. See docs/applet-contract.md for the author-facing version.

export interface PreparedState {
  name: string;
  state: unknown;
  phase: number;
}

/** Declared by the applet in <script type="application/json" id="conductor-manifest">. */
export interface Manifest {
  title: string;
  phases: string[];
  instructions: string;
  pulsePrompt: string;
  namelist?: string[];
  preparedStates?: PreparedState[];
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

/** Applet to host. */
export type AppletMessage =
  | { cc: "connect" }
  | { cc: "update"; state: unknown; phase: number; seq: number }
  /** Replaces the filters the name wheel offers. Only the teacher's frame is heard. */
  | { cc: "filters"; filters: WheelFilter[] }
  /** Drives the name wheel with WheelOptions. Only the teacher's frame is heard. */
  | { cc: "wheel"; options: unknown }
  /** The controls shortcut, pressed while the applet has focus. */
  | { cc: "shortcut" }
  /** Starts a countdown, or cancels it when seconds is null. Shared unless shared is false. Only the teacher's frame is heard. */
  | { cc: "timer"; seconds: number | null; shared: boolean };

/** Host to applet. maxPhase null lifts the limit. */
export type HostMessage =
  | { cc: "setState"; state: unknown; phase: number; seq: number }
  | { cc: "phaseLimit"; maxPhase: number | null }
  | { cc: "context"; context: AppletContext };
