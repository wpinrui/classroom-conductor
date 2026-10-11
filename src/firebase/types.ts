// Realtime Database data model. Every path is built in paths.ts.
//
// /teachers/{teacherUid}/applets/{appletId}  LibraryApplet
// /codes/{joinCode}                          JoinCode
// /live/{sessionId}                          true while a session runs (Engine index)
// /sessions/{sessionId}                      Session (children below)

import type { Manifest } from "../applet/contract";

export const MODES = [
  "demo",
  "spotlight",
  "anonymousSpotlight",
  "gallery",
  "independent",
  "group",
  "paced",
  "freeze",
  "focus",
  "reveal",
] as const;
export type Mode = (typeof MODES)[number];

/** Applet state is arbitrary JSON, stored as a string so it round-trips exactly. */
export interface StoredState {
  json: string;
  phase: number;
  at: number;
}

export interface LibraryApplet {
  name: string;
  html: string;
  manifest: Manifest;
  createdAt: number;
}

export interface JoinCode {
  teacher: string;
  session: string;
}

/** Chat messages per student per minute when Control.chatLimit is absent. */
export const DEFAULT_CHAT_LIMIT = 6;

export interface Control {
  mode: Mode;
  /** Student uid shown in Spotlight and Anonymous Spotlight. */
  spotlight?: string;
  /** Student uids shown side by side in Gallery. */
  gallery?: Record<string, true>;
  /** Phase everyone is held to in Paced. */
  pacedPhase?: number;
  /** State shown on every student's applet in Reveal. */
  reveal?: StoredState;
  groupSize?: number;
  /** Chat messages per student per minute. Absent means the default. 0 means unlimited. */
  chatLimit?: number;
}

/** Chat messages per student per minute when control.chatLimit is absent. */
export const DEFAULT_CHAT_LIMIT = 5;

export interface Student {
  name: string;
  /** nameKey(name); matches a namelist key when the applet has a namelist. */
  key: string;
  joinedAt: number;
  group?: string;
}

export interface Group {
  code: string;
  members: Record<string, true>;
  state?: StoredState;
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

export interface Session {
  teacher: string;
  code: string;
  createdAt: number;
  ended?: number;
  applet: { name: string; html: string; manifest: Manifest };
  /** nameKey to display name, copied from the manifest. Absent when any name may join. */
  namelist?: Record<string, string>;
  control: Control;
  teacherState?: StoredState;
  students?: Record<string, Student>;
  presence?: Record<string, true>;
  states?: Record<string, StoredState>;
  groups?: Record<string, Group>;
  chat?: Record<string, Record<string, ChatMessage>>;
  requests?: Record<string, EngineRequest>;
  pulses?: Record<string, Pulse>;
}
