import { MODES, type Mode } from "../firebase/types";
import type { Manifest, PreparedState, Slide } from "./contract";

const MANIFEST_RE =
  /<script[^>]*\bid=["']conductor-manifest["'][^>]*>([\s\S]*?)<\/script>/i;

export class ManifestError extends Error {}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isPrepared(
  v: unknown,
): v is { name: string; state: unknown; phase: number } {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.name === "string" && Number.isInteger(p.phase) && "state" in p
  );
}

/** Same limit as a scripted timer. */
const MAX_TIMER_SECONDS = 24 * 3600;

const isMode = (v: unknown): v is Mode =>
  typeof v === "string" && (MODES as readonly string[]).includes(v);

const nonEmpty = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";

/** Validates one slideshow step and returns it with only the fields it declares. */
function parseSlide(
  v: unknown,
  i: number,
  phaseCount: number,
  prepared: string[],
): Slide {
  const fail = (why: string): never => {
    throw new ManifestError(`slides[${i}] ${why}`);
  };
  if (typeof v !== "object" || v === null || Array.isArray(v))
    fail("must be an object");
  const s = v as Record<string, unknown>;
  if (!nonEmpty(s.label)) fail("needs a non-empty label");
  const out: Slide = { label: s.label as string };
  if (s.phase !== undefined) {
    if (
      !Number.isInteger(s.phase) ||
      (s.phase as number) < 0 ||
      (s.phase as number) >= phaseCount
    )
      fail("names a phase that is not declared");
    out.phase = s.phase as number;
  }
  if (s.mode !== undefined) {
    if (!isMode(s.mode)) fail(`names an unknown mode: ${String(s.mode)}`);
    out.mode = s.mode as Mode;
  }
  if (s.cue !== undefined) {
    if (!nonEmpty(s.cue)) fail("cue must be a non-empty string");
    out.cue = s.cue as string;
  }
  if (s.wheel !== undefined) {
    const w = s.wheel as Record<string, unknown>;
    if (typeof w !== "object" || w === null || Array.isArray(w))
      fail("wheel must be an object");
    if (w.filter !== undefined && typeof w.filter !== "string")
      fail("wheel.filter must be a string");
    if (w.spin !== undefined && typeof w.spin !== "boolean")
      fail("wheel.spin must be true or false");
    out.wheel = {
      ...(typeof w.filter === "string" ? { filter: w.filter } : {}),
      ...(typeof w.spin === "boolean" ? { spin: w.spin } : {}),
    };
  }
  if (s.timer !== undefined) {
    if (
      typeof s.timer !== "number" ||
      !(s.timer > 0) ||
      s.timer > MAX_TIMER_SECONDS
    )
      fail(`timer must be seconds above 0 and at most ${MAX_TIMER_SECONDS}`);
    out.timer = s.timer as number;
  }
  if (s.timerShared !== undefined) {
    if (typeof s.timerShared !== "boolean")
      fail("timerShared must be true or false");
    out.timerShared = s.timerShared as boolean;
  }
  if (s.reveal !== undefined) {
    if (typeof s.reveal !== "string" || !prepared.includes(s.reveal))
      fail("reveal must name a prepared state");
    if (out.mode !== undefined && out.mode !== "reveal")
      fail("cannot set a mode other than reveal beside reveal");
    out.reveal = s.reveal as string;
  }
  return out;
}

/** Extracts and validates the manifest an applet file declares. */
export function parseManifest(html: string): Manifest {
  const match = MANIFEST_RE.exec(html);
  if (!match) throw new ManifestError("No conductor-manifest script found");
  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    throw new ManifestError("conductor-manifest is not valid JSON");
  }
  if (typeof raw !== "object" || raw === null)
    throw new ManifestError("conductor-manifest must be an object");
  const m = raw as Record<string, unknown>;
  if (typeof m.title !== "string" || !m.title.trim())
    throw new ManifestError("title must be a non-empty string");
  if (!isStringArray(m.phases) || m.phases.length === 0)
    throw new ManifestError("phases must be a non-empty list of names");
  if (m.instructions !== undefined && typeof m.instructions !== "string")
    throw new ManifestError("instructions must be a string");
  if (m.pulsePrompt !== undefined && typeof m.pulsePrompt !== "string")
    throw new ManifestError("pulsePrompt must be a string");
  if (m.namelist !== undefined && !isStringArray(m.namelist))
    throw new ManifestError("namelist must be a list of names");
  if (
    m.preparedStates !== undefined &&
    !(Array.isArray(m.preparedStates) && m.preparedStates.every(isPrepared))
  )
    throw new ManifestError(
      "preparedStates must be a list of { name, state, phase }",
    );
  const phaseCount = m.phases.length;
  const prepared = m.preparedStates as
    | { name: string; state: unknown; phase: number }[]
    | undefined;
  if (prepared?.some((p) => p.phase < 0 || p.phase >= phaseCount))
    throw new ManifestError(
      "a prepared state names a phase that is not declared",
    );
  if (
    m.handoff !== undefined &&
    typeof m.handoff !== "boolean" &&
    !(
      Array.isArray(m.handoff) &&
      m.handoff.every((p) => Number.isInteger(p) && p >= 0 && p < phaseCount)
    )
  )
    throw new ManifestError(
      "handoff must be true, false or a list of phase indexes",
    );
  let modes: Mode[][] | undefined;
  if (m.modes !== undefined) {
    if (!Array.isArray(m.modes) || !m.modes.every(isStringArray))
      throw new ManifestError("modes must be a list of mode lists");
    if (m.modes.length !== phaseCount)
      throw new ManifestError("modes must have exactly one list per phase");
    if (m.modes.some((list) => list.length === 0))
      throw new ManifestError(
        "each phase in modes must allow at least one mode",
      );
    const unknown = m.modes.flat().find((id) => !isMode(id));
    if (unknown !== undefined)
      throw new ManifestError(`modes names an unknown mode: ${unknown}`);
    modes = m.modes as Mode[][];
  }
  let slides: Slide[] | undefined;
  if (m.slides !== undefined) {
    if (!Array.isArray(m.slides))
      throw new ManifestError("slides must be a list of steps");
    const names = (prepared ?? []).map((p) => p.name);
    slides = m.slides.map((v, i) => parseSlide(v, i, phaseCount, names));
  }
  return {
    title: m.title,
    phases: m.phases,
    ...(typeof m.instructions === "string"
      ? { instructions: m.instructions }
      : {}),
    ...(typeof m.pulsePrompt === "string"
      ? { pulsePrompt: m.pulsePrompt }
      : {}),
    ...(m.namelist ? { namelist: m.namelist as string[] } : {}),
    ...(prepared
      ? {
          preparedStates: prepared.map(
            (p): PreparedState => ({
              name: p.name,
              json: JSON.stringify(p.state),
              phase: p.phase,
            }),
          ),
        }
      : {}),
    ...(modes ? { modes } : {}),
    ...(m.handoff === false || Array.isArray(m.handoff)
      ? { handoff: m.handoff as false | number[] }
      : {}),
    ...(slides && slides.length > 0 ? { slides } : {}),
  };
}

/** Normalised name used as a database key and for namelist matching. */
export function nameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.#$[\]/]/g, "_");
}
