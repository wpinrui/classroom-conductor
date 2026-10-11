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
  | { cc: "shortcut" };

/** Host to applet. maxPhase null lifts the limit. */
export type HostMessage =
  | { cc: "setState"; state: unknown; phase: number; seq: number }
  | { cc: "phaseLimit"; maxPhase: number | null };
