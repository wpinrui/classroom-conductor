import { useEffect, useRef, useState } from "react";
import type { WheelFilter } from "../applet/contract";
import { setStage, setWheel } from "../firebase/client";
import type { Session } from "../firebase/types";
import { spin as requestSpin, spotlightStudent } from "../stage/actions";
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
  /** The request this spin answers. */
  n: number;
}

const EVERYONE = "";
const FULL_TURNS = 5;
const RADIUS = 100;
const LABEL_RADIUS = 92;
const MAX_NAME = 16;

const keyOf = (m: Member[]) => m.map((x) => x.uid).join(",");

/** The element's transition duration in milliseconds, 0 when it has none. */
function durationMs(el: Element | null): number {
  if (!el) return 0;
  const d = getComputedStyle(el).transitionDuration.split(",")[0].trim();
  const n = Number.parseFloat(d) || 0;
  return d.endsWith("ms") ? n : n * 1000;
}

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

/** The applet's filters, as the projection published them. */
export function wheelFilters(data: Session): WheelFilter[] {
  try {
    const f = JSON.parse(data.stage?.wheel?.filters ?? "[]");
    return Array.isArray(f) ? f : [];
  } catch {
    return [];
  }
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

/** The wheel's pools and who is in them, shared by the projection and the remote. */
export function wheelPools(data: Session) {
  const filters = wheelFilters(data);
  const settings = data.control.wheel ?? {};
  const replacement = settings.replacement ?? true;
  const drawn = settings.drawn ?? {};
  const chosen = data.stage?.wheel?.pool ?? EVERYONE;
  const filter = filters.find((f) => f.name === chosen);
  const pool = filter ? chosen : EVERYONE;
  const drawable = (uids: string[] | null) =>
    poolMembers(data, uids).filter((m) => replacement || !drawn[m.uid]);
  return {
    pool,
    replacement,
    anyDrawn: Object.keys(drawn).length > 0,
    everyone: poolMembers(data, filter ? filter.students : null),
    candidates: drawable(filter ? filter.students : null),
    options: [
      { name: EVERYONE, count: drawable(null).length },
      ...filters.map((f) => ({
        name: f.name,
        count: drawable(f.students ?? []).length,
      })),
    ],
  };
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

/**
 * The name wheel on the projection. It spins once per request the remote or the applet writes,
 * and reports where it landed. Its chips show state and take no input, unless live.
 */
export function Wheel({
  data,
  session,
  onPicked,
  live: takesInput = false,
}: {
  data: Session;
  session: string;
  /** Called once per spin, with the student it landed on. */
  onPicked: (uid: string) => void;
  /** True while the projection's controls overlay is open: the wheel then takes input. */
  live?: boolean;
}) {
  const [spin, setSpin] = useState<Spin | null>(null);
  const disc = useRef<SVGGElement>(null);
  const { pool, replacement, anyDrawn, everyone, candidates, options } =
    wheelPools(data);
  const spinning = !!spin && !spin.done;
  // With No repeats, a drawn student leaves the wheel as soon as the spin lands.
  const live = replacement ? everyone : candidates;
  // A finished spin stays on screen until the pool it was drawn from changes.
  const held =
    spin && (spinning || (replacement && keyOf(spin.members) === keyOf(live)));
  const members = held ? spin.members : live;
  const winner = held && spin.done ? spin.winner : null;
  /** The student the last spin landed on, shown under the wheel even once they leave it. */
  const picked = spin?.done ? spin.members[spin.winner] : undefined;

  const go = (n: number) => {
    // Everyone has had a turn: start a fresh round instead of refusing to spin.
    const refill = candidates.length === 0 && !replacement;
    const list = refill ? everyone : candidates;
    if (list.length === 0) return setStage(session, { "wheel/result": { n } });
    const prev = picked?.uid ?? null;
    // Never call the same student twice running when anyone else is left.
    const last = list.length > 1 ? list.findIndex((m) => m.uid === prev) : -1;
    let pick = randomIndex(list.length - (last >= 0 ? 1 : 0));
    if (last >= 0 && pick >= last) pick += 1;
    const jitter = randomIndex(1000) / 1000 - 0.5;
    const turn = landingTurn(spin?.turn ?? 0, pick, list.length, jitter);
    setSpin({ members: list, winner: pick, turn, done: false, n });
    // Backstop for when transitionend never fires, such as a spin started before the wheel was painted.
    const ms = durationMs(disc.current) + 300;
    setTimeout(
      () => setSpin((s) => (s && s.turn === turn ? { ...s, done: true } : s)),
      ms,
    );
    if (!replacement)
      setWheel(session, {
        ...(refill
          ? Object.fromEntries(list.map((m) => [`drawn/${m.uid}`, null]))
          : {}),
        [`drawn/${list[pick].uid}`]: true,
      });
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

  // A request the wheel has not answered yet spins it, including one made while it was closed.
  // Two frames later the wheel has been painted, so the spin animates instead of jumping.
  const request = data.stage?.wheel?.spin ?? 0;
  const answered = useRef(data.stage?.wheel?.result?.n ?? 0);
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (request <= answered.current) return;
    answered.current = request;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => goRef.current(request)),
    );
  }, [request]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: report once per finished spin
  useEffect(() => {
    if (!spin?.done) return;
    const uid = spin.members[spin.winner]?.uid;
    if (!uid) return;
    onPicked(uid);
    setStage(session, { "wheel/result": { uid, n: spin.n } });
  }, [spin?.done, spin?.turn]);

  const n = members.length;
  const font = Math.min(7, (2 * Math.PI * 62 * 0.55) / Math.max(n, 1));

  return (
    <section className="wheel-sheet" aria-label="Name wheel">
      <div className="wheel-bar">
        {options.length > 1 && (
          <div className="wheel-pools">
            {options.map((o) =>
              takesInput ? (
                <button
                  key={o.name}
                  type="button"
                  className="wheel-pool"
                  aria-pressed={pool === o.name}
                  disabled={spinning}
                  onClick={() =>
                    setStage(session, { "wheel/pool": o.name || null })
                  }
                >
                  {o.name || "Everyone"}
                  <span className="wheel-count">{o.count}</span>
                </button>
              ) : (
                <span
                  key={o.name}
                  className="wheel-pool"
                  data-on={pool === o.name || undefined}
                >
                  {o.name || "Everyone"}
                  <span className="wheel-count">{o.count}</span>
                </span>
              ),
            )}
          </div>
        )}
        {takesInput && (
          <div className="wheel-settings">
            <button
              type="button"
              className="wheel-pool"
              aria-pressed={!replacement}
              onClick={() =>
                setWheel(session, {
                  replacement: !replacement,
                  teacherSet: true,
                })
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
        )}
        {!takesInput && !replacement && (
          <div className="wheel-settings">
            <span className="wheel-pool" data-on>
              No repeats
            </span>
          </div>
        )}
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
        {takesInput ? (
          <button
            type="button"
            className="primary wheel-hub"
            disabled={spinning || everyone.length === 0}
            onClick={() => requestSpin(session, data.stage ?? {})}
          >
            Spin
          </button>
        ) : (
          <div className="wheel-hub" />
        )}
      </div>
      <div className="wheel-result">
        <output className="wheel-winner" aria-live="polite">
          {picked?.name ?? ""}
        </output>
        {takesInput && picked && (
          <button
            type="button"
            className="quiet icon-button"
            aria-label="Spotlight"
            data-tip="Spotlight"
            onClick={() => {
              spotlightStudent(session, data, picked.uid);
              setStage(session, { "wheel/open": null });
            }}
          >
            <SpotlightIcon />
          </button>
        )}
      </div>
    </section>
  );
}
