import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { AppletFrame, TeacherStateContext } from "../applet/AppletFrame";
import type {
  ClassMember,
  WheelFilter,
  WheelOptions,
} from "../applet/contract";
import { Chat } from "../chat/Chat";
import { setControl, setWheel, writeTeacherState } from "../firebase/client";
import type { Session, StoredState } from "../firebase/types";
import { useSession, useThrottledWriter } from "../hooks/session";
import { PulsePanel } from "../pulse/Pulse";
import { Countdown } from "../timer/Countdown";
import { scriptTimer } from "../timer/timer";
import { Controls } from "./Controls";
import { allowedModes, defaultsFor, teacherPhase } from "./modes";
import { Wheel, type WheelCommand } from "./Wheel";

/** The teacher's live view: their own applet with the controls overlaid. */
export function TeacherSession() {
  const { session = "" } = useParams();
  const data = useSession(session);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [filters, setFilters] = useState<WheelFilter[]>([]);
  const [wheelCommand, setWheelCommand] = useState<WheelCommand | null>(null);
  const commands = useRef(0);
  const [wheelPick, setWheelPick] = useState<{
    student: string;
    n: number;
  } | null>(null);
  const [blank, setBlank] = useState(false);
  const blankOn = () => {
    // Pull focus out of the applet, so the next key reaches the page and ends the blank.
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    setBlank(true);
  };

  /** Spotlights a student, keeping Anonymous Spotlight anonymous. Null ends the spotlight. */
  const spotlight = (uid: string | null) => {
    if (uid === null) return setControl(session, { spotlight: null });
    if (!data?.students?.[uid]) return;
    const m = data.control.mode;
    setControl(session, {
      spotlight: uid,
      ...(m === "spotlight" || m === "anonymousSpotlight"
        ? {}
        : { mode: "spotlight" }),
    });
  };

  /** The applet drives the name wheel. The teacher can still close or change it from the controls. */
  const onWheel = (raw: unknown) => {
    if (typeof raw !== "object" || raw === null) return;
    const o = raw as WheelOptions;
    // Once the teacher has chosen, the applet's choice no longer applies.
    if (typeof o.replacement === "boolean" && !data?.control.wheel?.teacherSet)
      setWheel(session, { replacement: o.replacement });
    if (o.open === false && !o.spin) return setWheelOpen(false);
    const filter = typeof o.filter === "string" ? o.filter : undefined;
    if (o.open || o.spin) setWheelOpen(true);
    if (filter !== undefined || o.spin)
      setWheelCommand({ filter, spin: !!o.spin, n: ++commands.current });
  };
  const write = useThrottledWriter((s: StoredState) =>
    writeTeacherState(session, s),
  );

  // While blank, any key or click brings the screen back.
  useEffect(() => {
    if (!blank) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      setBlank(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [blank]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: blankOn only calls state setters
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const typing =
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !typing && e.key === "b") {
        e.preventDefault();
        blankOn();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        e.preventDefault();
        setControlsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // When the applet narrows the modes per phase, leave a mode the current phase does not allow.
  const allowed = data ? allowedModes(data) : null;
  const mode = data?.control.mode;
  const phase = data ? teacherPhase(data) : 0;
  const requested = useRef("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: allowed and data are derived from mode and phase
  useEffect(() => {
    if (!data || !allowed || !mode) return;
    if (allowed.includes(mode)) {
      requested.current = "";
      return;
    }
    const next = allowed[0];
    const key = `${phase}:${mode}:${next}`;
    if (requested.current === key) return;
    requested.current = key;
    setControl(session, { mode: next, ...defaultsFor(next, data) });
  }, [session, mode, phase, allowed?.join()]);

  if (!data) return null;
  const { manifest } = data.applet;
  const target =
    data.control.mode === "spotlight" ||
    data.control.mode === "anonymousSpotlight"
      ? data.control.spotlight
      : undefined;
  return (
    <main className="stage">
      <TeacherStateContext.Provider value={data.teacherState ?? null}>
        <TeacherApplet
          data={data}
          onUpdate={write}
          onShortcut={() => setControlsOpen((o) => !o)}
          onFilters={setFilters}
          onTimer={(seconds, shared) => scriptTimer(session, seconds, shared)}
          onWheel={onWheel}
          onSpotlight={(raw) => spotlight(typeof raw === "string" ? raw : null)}
          wheelPick={wheelPick}
        />
        {target && data.students?.[target] && (
          <div className="teacher-spotlight">
            <AppletFrame
              key={target}
              html={data.applet.html}
              state={data.states?.[target] ?? null}
              interactive={false}
            />
            {data.control.mode === "spotlight" && (
              <div className="name-pill">{data.students[target].name}</div>
            )}
          </div>
        )}
        {data.control.timer && <Countdown timer={data.control.timer} />}
        {data.teacherTimer && <Countdown timer={data.teacherTimer} private />}
        {controlsOpen && (
          <Controls
            session={session}
            data={data}
            wheelOpen={wheelOpen}
            onWheel={() => setWheelOpen((o) => !o)}
            onBlank={blankOn}
          />
        )}
      </TeacherStateContext.Provider>
      {wheelOpen && (
        <Wheel
          data={data}
          session={session}
          filters={filters}
          command={wheelCommand}
          onCommandDone={() => setWheelCommand(null)}
          onClose={() => setWheelOpen(false)}
          onPicked={(student) =>
            setWheelPick((p) => ({ student, n: (p?.n ?? 0) + 1 }))
          }
          onSpotlight={(uid) => {
            spotlight(uid);
            setWheelOpen(false);
          }}
        />
      )}
      {manifest.pulsePrompt !== undefined && <PulsePanel session={session} />}
      {manifest.instructions !== undefined && (
        <Chat session={session} uid={data.teacher} teacher />
      )}
      {blank && (
        // biome-ignore lint/a11y/noStaticElementInteractions: any key also ends the blank
        // biome-ignore lint/a11y/useKeyWithClickEvents: any key also ends the blank
        <div className="blank" onClick={() => setBlank(false)} />
      )}
    </main>
  );
}

/** Every student with their parsed state, as the teacher's applet sees them. */
function useClass(data: Session): Record<string, ClassMember> {
  const { students, states, presence } = data;
  return useMemo(() => {
    const out: Record<string, ClassMember> = {};
    for (const [uid, s] of Object.entries(students ?? {})) {
      const stored = states?.[uid];
      out[uid] = {
        name: s.name,
        phase: stored?.phase ?? 0,
        state: stored ? JSON.parse(stored.json) : null,
        online: !!presence?.[uid],
      };
    }
    return out;
  }, [students, states, presence]);
}

/** Mounts once per session so later teacherState echoes do not reset the applet. */
function TeacherApplet({
  data,
  onUpdate,
  onShortcut,
  onFilters,
  onTimer,
  onWheel,
  onSpotlight,
  wheelPick,
}: {
  data: Session;
  onUpdate: (s: StoredState) => void;
  onShortcut: () => void;
  onFilters: (f: WheelFilter[]) => void;
  onTimer: (seconds: unknown, shared: unknown) => void;
  onWheel: (options: unknown) => void;
  onSpotlight: (student: unknown) => void;
  wheelPick: { student: string; n: number } | null;
}) {
  const [initial] = useState(data.teacherState ?? null);
  const students = useClass(data);
  return (
    <AppletFrame
      html={data.applet.html}
      state={initial}
      onUpdate={onUpdate}
      onShortcut={onShortcut}
      owner="teacher"
      students={students}
      onFilters={onFilters}
      onTimer={onTimer}
      onWheel={onWheel}
      onSpotlight={onSpotlight}
      wheelPick={wheelPick}
    />
  );
}
