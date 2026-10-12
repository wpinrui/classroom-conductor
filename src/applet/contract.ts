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

/** Applet to host. */
export type AppletMessage =
  | { cc: "connect" }
  | { cc: "update"; state: unknown; phase: number; seq: number }
  /** The controls shortcut, pressed while the applet has focus. */
  | { cc: "shortcut" }
  | ToolMessage;

/**
 * Class tools an applet can script. Only the teacher's own applet is heard.
 * The teacher can override any of them from the controls at any time.
 */
export type ToolMessage =
  /** Starts a countdown, or cancels it when seconds is null. Shared unless shared is false. */
  { cc: "timer"; seconds: number | null; shared?: boolean };

const TOOLS: ReadonlySet<string> = new Set<ToolMessage["cc"]>(["timer"]);
export const isTool = (m: { cc?: unknown } | null): m is ToolMessage =>
  typeof m?.cc === "string" && TOOLS.has(m.cc);

/** Host to applet. maxPhase null lifts the limit. */
export type HostMessage =
  | { cc: "setState"; state: unknown; phase: number; seq: number }
  | { cc: "phaseLimit"; maxPhase: number | null };
