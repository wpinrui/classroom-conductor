import { useEffect, useRef, useState } from "react";
import type { WheelFilter } from "../applet/contract";
import { setWheel } from "../firebase/client";
import type { Session } from "../firebase/types";
import { ResetIcon, SpotlightIcon } from "./icons";
import "./wheel.css";

interface Member {
  uid: string;
  name: string;
}

interface Spin {
  /** Members on the wheel when it was spun, so later joins do not move the slices. */
  members: Member[];
  winner: number;
  /** Total clockwise rotation in degrees. It only grows, so every spin turns forward. */
  turn: number;
  done: boolean;
}

const EVERYONE = "";
const FULL_TURNS = 5;
const RADIUS = 100;
const LABEL_RADIUS = 92;
const MAX_NAME = 16;

const keyOf = (m: Member[]) => m.map((x) => x.uid).join(",");

/** A uniform random index below n, from the crypto source. */
export function randomIndex(n: number): number {
  const buf = new Uint32Array(1);
  const limit = 2 ** 32 - (2 ** 32 % n);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

/** Rotation that brings slice `index` of `count` under the top pointer, at least FULL_TURNS ahead of `from`. */
export function landingTurn(
  from: number,
  index: number,
  count: number,
  jitter: number,
): number {
  const slice = 360 / count;
  const target = 360 - (index + 0.5 + jitter * 0.7) * slice;
  const ahead = (((target - from) % 360) + 360) % 360;
  return from + FULL_TURNS * 360 + ahead;
}

/** Online students in a pool, by name. */
function poolMembers(data: Session, uids: string[] | null): Member[] {
  const students = data.students ?? {};
  const ids = uids ?? Object.keys(students);
  return [...new Set(ids)]
    .filter((uid) => students[uid] && data.presence?.[uid])
    .map((uid) => ({ uid, name: students[uid].name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const short = (name: string) =>
  name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;

/** A point on the wheel, clockwise from the top. */
function at(deg: number, r: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`;
}

function slicePath(i: number, n: number) {
  const a = (360 / n) * i;
  const b = (360 / n) * (i + 1);
  return `M0 0L${at(a, RADIUS)}A${RADIUS} ${RADIUS} 0 ${b - a > 180 ? 1 : 0} 1 ${at(b, RADIUS)}Z`;
}

/** The name wheel: picks a random online student from the class or from a filter the applet publishes. */
export interface WheelCommand {
  /** Filter to select. Undefined keeps the current one. */
  filter?: string;
  spin: boolean;
  /** Grows with every command, so each one acts exactly once. */
  n: number;
}

export function Wheel({
  data,
  session,
  filters,
  command,
  onCommandDone,
  onClose,
  onPicked,
  onSpotlight,
}: {
  data: Session;
  session: string;
  filters: WheelFilter[];
  command: WheelCommand | null;
  onCommandDone: () => void;
  onClose: () => void;
  /** Called once per spin, with the student it landed on. */
  onPicked: (uid: string) => void;
  onSpotlight: (uid: string) => void;
}) {
  const [chosen, setChosen] = useState(EVERYONE);
  const [spin, setSpin] = useState<Spin | null>(null);
  const disc = useRef<SVGGElement>(null);
  /** The pool a pending command spins once it is on screen, or null. */
  const spinNext = useRef<string | null>(null);
  const lastCommand = useRef(0);
  /** Turn of the last spin reported to onPicked. Every spin has its own turn. */
  const reported = useRef(0);
  const settings = data.control.wheel ?? {};
  const replacement = settings.replacement ?? true;
  const drawn = settings.drawn ?? {};
  const filter = filters.find((f) => f.name === chosen);
  const pool = chosen === EVERYONE || !filter ? EVERYONE : chosen;
  const spinning = !!spin && !spin.done;
  // The student just drawn stays on the wheel until it moves on, even when drawing them took them out.
  const shownWinner = spin?.done ? spin.members[spin.winner]?.uid : undefined;
  const drawable = (uids: string[] | null) =>
    poolMembers(data, uids).filter((m) => replacement || !drawn[m.uid]);
  const candidates = drawable(filter ? filter.students : null);
  const live = poolMembers(data, filter ? filter.students : null).filter(
    (m) => replacement || !drawn[m.uid] || m.uid === shownWinner,
  );
  // A finished spin stays on screen until the pool it was drawn from changes.
  const held = spin && (spinning || keyOf(spin.members) === keyOf(live));
  const members = held ? spin.members : live;
  const winner = held && spin.done ? spin.winner : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = () => {
    if (spinning || candidates.length === 0) return;
    const prev = held && spin?.done ? spin.members[spin.winner]?.uid : null;
    // Never call the same student twice running when anyone else is left.
    const last =
      candidates.length > 1 ? candidates.findIndex((m) => m.uid === prev) : -1;
    let pick = randomIndex(candidates.length - (last >= 0 ? 1 : 0));
    if (last >= 0 && pick >= last) pick += 1;
    const jitter = randomIndex(1000) / 1000 - 0.5;
    const turn = landingTurn(spin?.turn ?? 0, pick, candidates.length, jitter);
    setSpin({ members: candidates, winner: pick, turn, done: false });
    if (!replacement)
      setWheel(session, { [`drawn/${candidates[pick].uid}`]: true });
    // Reduced motion zeroes the transition, so transitionend never fires.
    requestAnimationFrame(() => {
      const el = disc.current;
      if (
        el &&
        Number.parseFloat(getComputedStyle(el).transitionDuration) === 0
      )
        setSpin((s) => s && { ...s, done: true });
    });
  };

  const choose = (name: string) => {
    if (spinning) return;
    setChosen(name);
    setSpin((s) => s && { ...s, done: true });
  };

  // An applet's command picks the pool now and spins once that pool has rendered.
  // biome-ignore lint/correctness/useExhaustiveDependencies: act once per command
  useEffect(() => {
    if (!command || command.n === lastCommand.current) return;
    lastCommand.current = command.n;
    if (command.filter !== undefined) choose(command.filter);
    if (command.spin) spinNext.current = command.filter ?? chosen;
    onCommandDone();
  }, [command?.n]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: report once per finished spin
  useEffect(() => {
    if (!spin?.done || spin.turn === reported.current) return;
    reported.current = spin.turn;
    const uid = spin.members[spin.winner]?.uid;
    if (uid) onPicked(uid);
  }, [spin?.done, spin?.turn]);

  // Runs after every render, so it sees the pool the command picked.
  useEffect(() => {
    if (spinNext.current !== chosen || spinning) return;
    spinNext.current = null;
    go();
  });

  const n = members.length;
  const font = Math.min(7, (2 * Math.PI * 62 * 0.55) / Math.max(n, 1));
  const options = [
    { name: EVERYONE, count: drawable(null).length },
    ...filters.map((f) => ({
      name: f.name,
      count: drawable(f.students).length,
    })),
  ];
  const anyDrawn = Object.keys(drawn).length > 0;

  return (
    <section className="wheel-sheet" aria-label="Name wheel">
      <button
        type="button"
        className="quiet wheel-close"
        aria-label="Close"
        onClick={onClose}
      >
        ✕
      </button>
      <div className="wheel-bar">
        {options.length > 1 && (
          <div className="wheel-pools">
            {options.map((o) => (
              <button
                key={o.name}
                type="button"
                className="wheel-pool"
                aria-pressed={pool === o.name}
                disabled={spinning}
                onClick={() => choose(o.name)}
              >
                {o.name || "Everyone"}
                <span className="wheel-count">{o.count}</span>
              </button>
            ))}
          </div>
        )}
        <div className="wheel-settings">
          <button
            type="button"
            className="wheel-pool"
            aria-pressed={!replacement}
            onClick={() =>
              setWheel(session, { replacement: !replacement, teacherSet: true })
            }
          >
            No repeats
          </button>
          {anyDrawn && (
            <button
              type="button"
              className="quiet icon-button"
              aria-label="Put everyone back"
              data-tip="Put everyone back"
              disabled={spinning}
              onClick={() => setWheel(session, { drawn: null })}
            >
              <ResetIcon />
            </button>
          )}
        </div>
      </div>
      <div className="wheel" data-empty={n === 0 || undefined}>
        <svg viewBox="-114 -114 228 228" className="wheel-svg" aria-hidden>
          <g
            ref={disc}
            className="wheel-disc"
            style={{ transform: `rotate(${spin?.turn ?? 0}deg)` }}
            onTransitionEnd={(e) => {
              // Slice fills transition too, and their ends bubble up here.
              if (e.target === e.currentTarget)
                setSpin((s) => s && { ...s, done: true });
            }}
          >
            {n <= 1 ? (
              <circle
                r={RADIUS}
                className="wheel-slice"
                data-tone={0}
                data-won={(n === 1 && winner === 0) || undefined}
              />
            ) : (
              members.map((m, i) => (
                <path
                  key={m.uid}
                  d={slicePath(i, n)}
                  className="wheel-slice"
                  // An odd count gets a third tone on the last slice, so no two neighbours match.
                  data-tone={n % 2 === 1 && i === n - 1 ? 2 : i % 2}
                  data-won={winner === i || undefined}
                />
              ))
            )}
            {members.map((m, i) => {
              const mid = (360 / n) * (i + 0.5);
              // Names on the left half turn round, so none reads upside down.
              const left = mid > 180;
              return (
                <text
                  key={m.uid}
                  className="wheel-name"
                  data-won={winner === i || undefined}
                  transform={
                    left
                      ? `rotate(${mid + 90}) translate(${-LABEL_RADIUS} 0)`
                      : `rotate(${mid - 90}) translate(${LABEL_RADIUS} 0)`
                  }
                  fontSize={n === 1 ? 10 : font}
                  textAnchor={left ? "start" : "end"}
                  dominantBaseline="central"
                >
                  {short(m.name)}
                </text>
              );
            })}
          </g>
          <circle r={RADIUS} className="wheel-rim" />
          <path d="M-7 -111 L7 -111 L0 -96 Z" className="wheel-pointer" />
        </svg>
        <button
          type="button"
          className="primary wheel-hub"
          disabled={candidates.length === 0}
          onClick={go}
        >
          Spin
        </button>
      </div>
      <div className="wheel-result">
        <output className="wheel-winner" aria-live="polite">
          {winner !== null ? members[winner].name : ""}
        </output>
        {winner !== null && (
          <button
            type="button"
            className="quiet icon-button"
            aria-label="Spotlight"
            data-tip="Spotlight"
            onClick={() => onSpotlight(members[winner].uid)}
          >
            <SpotlightIcon />
          </button>
        )}
      </div>
    </section>
  );
}
