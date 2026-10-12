import { preparedJson } from "../applet/contract";
import { setControl } from "../firebase/client";
import type { Session, StoredState } from "../firebase/types";
import { teacherPhase } from "./modes";

const same = (a: StoredState | undefined, b: { json: string; phase: number }) =>
  !!a && a.json === b.json && a.phase === b.phase;

/** Picks the state Reveal pushes to every student: the teacher's current one or a prepared one for the teacher's phase. */
export function Reveal({ session, data }: { session: string; data: Session }) {
  const shown = data.control.reveal;
  const phase = teacherPhase(data);
  const prepared = (data.applet.manifest.preparedStates ?? [])
    .filter((p) => p.phase === phase)
    .map((p) => ({
      name: p.name,
      json: preparedJson(p),
      phase: p.phase,
    }));
  const isPrepared = prepared.some((p) => same(shown, p));
  const reveal = (s: { json: string; phase: number }) =>
    setControl(session, {
      reveal: { json: s.json, phase: s.phase, at: Date.now() },
    });

  return (
    <div className="choices">
      <button
        type="button"
        disabled={!data.teacherState}
        aria-pressed={!!shown && !isPrepared}
        onClick={() => data.teacherState && reveal(data.teacherState)}
      >
        Mine
      </button>
      {prepared.map((p) => (
        <button
          key={p.name}
          type="button"
          aria-pressed={same(shown, p)}
          onClick={() => reveal(p)}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
