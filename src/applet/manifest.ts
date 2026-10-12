import { MODES, type Mode } from "../firebase/types";
import type { Manifest, PreparedState } from "./contract";

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
  let modes: Mode[][] | undefined;
  if (m.modes !== undefined) {
    if (!Array.isArray(m.modes) || !m.modes.every(isStringArray))
      throw new ManifestError("modes must be a list of mode lists");
    if (m.modes.length !== phaseCount)
      throw new ManifestError("modes must have exactly one list per phase");
    if (m.modes.some((list) => list.length === 0))
      throw new ManifestError("each phase in modes must allow at least one mode");
    const unknown = m.modes
      .flat()
      .find((id) => !(MODES as readonly string[]).includes(id));
    if (unknown !== undefined)
      throw new ManifestError(`modes names an unknown mode: ${unknown}`);
    modes = m.modes as Mode[][];
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
