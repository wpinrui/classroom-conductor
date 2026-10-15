// Realtime Database data model. Every path is built in paths.ts.
//
// /teachers/{teacherUid}/applets/{appletId}  LibraryApplet
// /codes/{joinCode}                          JoinCode
// /live/{sessionId}                          true while a session runs (Engine index)
// /sessions/{sessionId}                      Session (children below)

import type { Manifest } from "../applet/contract";

/** What students see: the teacher's applet, or their own. */
export const MODES = ["demo", "work"] as const;
export type Mode = (typeof MODES)[number];

/** Applet state is arbitrary JSON, stored as a string so it round-trips exactly. */
export interface StoredState {
  json: string;
  phase: number;
  at: number;
  /** The control.reset this state already answered. */
  reset?: number;
}

export interface LibraryApplet {
  name: string;
  /** Only on applets saved before the page moved to its own path. */
  html?: string;
  manifest: Manifest;
  createdAt: number;
}

export interface JoinCode {
  teacher: string;
  session: string;
}

export interface Control {
  mode: Mode;
  /** Student uid everyone sees, over any mode. */
  spotlight?: string;
  /** Student screens go black. */
  dark?: boolean;
  /** When the teacher last pressed Reset. Each student's own applet answers it once. */
  reset?: number;
  /** Chat messages per student per minute. Absent means the default. 0 means unlimited. */
  chatLimit?: number;
  /** Countdown every student sees. */
  timer?: Timer;
  wheel?: WheelSettings;
}

/** Name wheel settings that last the whole session. */
export interface WheelSettings {
  /** False takes each drawn student out of the pool. Absent means true. */
  replacement?: boolean;
  /** True once the teacher has set replacement. The applet can no longer change it. */
  teacherSet?: boolean;
  /** Students drawn while replacement was off. */
  drawn?: Record<string, true>;
}

/**
 * A countdown. Running timers hold endsAt in server time, so clients compute
 * what is left without ticking writes. Paused timers hold the ms left instead.
 */
export interface Timer {
  endsAt?: number;
  left?: number;
}

/** Chat messages per student per minute when control.chatLimit is absent. */
export const DEFAULT_CHAT_LIMIT = 5;

export interface Student {
  name: string;
  /** nameKey(name); matches a namelist key when the applet has a namelist. */
  key: string;
  joinedAt: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  at: number;
}

export type EngineRequest =
  | { kind: "chat"; student: string; at: number; status: RequestStatus }
  | { kind: "pulse"; pulse: string; at: number; status: RequestStatus };
export type RequestStatus = "pending" | "done" | "error";

export interface Pulse {
  /** Absent for a whole-class Pulse. */
  student?: string;
  /** JSON snapshot of the states the Pulse reads, taken when it was requested. */
  input: string;
  at: number;
  status: RequestStatus;
  /** Code the Engine wrote to produce the Pulse. */
  code?: string;
  /** Freeform result, rendered as HTML. */
  output?: string;
}

/**
 * What the remote asks the projection to show. Only the teacher reads or writes it.
 * Counters ask for one action each time they grow, so every page acts on each request once.
 */
export interface Stage {
  blank?: boolean;
  join?: boolean;
  rules?: boolean;
  wheel?: {
    open?: boolean;
    /** Chosen pool: a filter name, or absent for everyone. */
    pool?: string;
    /** Grows once per spin request. */
    spin?: number;
    /** Written by the projection when spin n lands. uid is absent when the pool was empty. */
    result?: { uid?: string; n: number };
    /** The applet's filters as JSON text, written by the projection. */
    filters?: string;
  };
  slideshow?: {
    on?: boolean;
    /** The current step, written by the projection. Absent before the first step. */
    at?: number;
    /** Each new n asks the projection to step once in dir. */
    step?: { dir: 1 | -1; n: number };
  };
  /** The applet's teacher controls as JSON text, written by the projection. */
  controls?: string;
  /** Each new n asks the projection to pass this control to the applet. */
  control?: { id: string; value?: boolean | string; n: number };
  /** True when the teacher's applet answers Reset. Written by the projection. */
  canReset?: boolean;
}

export interface Session {
  teacher: string;
  code: string;
  createdAt: number;
  ended?: number;
  /** The page itself lives at sessionHtml. hash fingerprints it. html is only on older sessions. */
  applet: { name: string; manifest: Manifest; hash?: string; html?: string };
  /** nameKey to display name, copied from the manifest. Absent when any name may join. */
  namelist?: Record<string, string>;
  control: Control;
  /** Countdown only the teacher sees. Students cannot read it. */
  teacherTimer?: Timer;
  teacherState?: StoredState;
  students?: Record<string, Student>;
  presence?: Record<string, true>;
  states?: Record<string, StoredState>;
  chat?: Record<string, Record<string, ChatMessage>>;
  requests?: Record<string, EngineRequest>;
  pulses?: Record<string, Pulse>;
  stage?: Stage;
}
