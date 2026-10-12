import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { AppletFrame, TeacherStateContext } from "../applet/AppletFrame";
import type { ClassMember, WheelFilter } from "../applet/contract";
import { Chat } from "../chat/Chat";
import { writeTeacherState } from "../firebase/client";
import type { Session, StoredState } from "../firebase/types";
import { useSession, useThrottledWriter } from "../hooks/session";
import { PulsePanel } from "../pulse/Pulse";
import { Countdown } from "../timer/Countdown";
import { scriptTimer } from "../timer/timer";
import { Controls } from "./Controls";
import { Wheel } from "./Wheel";

/** The teacher's live view: their own applet with the controls overlaid. */
export function TeacherSession() {
  const { session = "" } = useParams();
  const data = useSession(session);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [filters, setFilters] = useState<WheelFilter[]>([]);
  const write = useThrottledWriter((s: StoredState) =>
    writeTeacherState(session, s),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        e.preventDefault();
        setControlsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!data) return null;
  return (
    <main className="stage">
      <TeacherStateContext.Provider value={data.teacherState ?? null}>
        <TeacherApplet
          data={data}
          onUpdate={write}
          onShortcut={() => setControlsOpen((o) => !o)}
          onFilters={setFilters}
          onTimer={(seconds, shared) => scriptTimer(session, seconds, shared)}
        />
        {data.control.timer && <Countdown timer={data.control.timer} />}
        {data.teacherTimer && <Countdown timer={data.teacherTimer} private />}
        {controlsOpen && (
          <Controls
            session={session}
            data={data}
            wheelOpen={wheelOpen}
            onWheel={() => setWheelOpen((o) => !o)}
          />
        )}
      </TeacherStateContext.Provider>
      {wheelOpen && (
        <Wheel
          data={data}
          filters={filters}
          onClose={() => setWheelOpen(false)}
        />
      )}
      <PulsePanel session={session} />
      <Chat session={session} uid={data.teacher} teacher />
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
}: {
  data: Session;
  onUpdate: (s: StoredState) => void;
  onShortcut: () => void;
  onFilters: (f: WheelFilter[]) => void;
  onTimer: (seconds: unknown, shared: unknown) => void;
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
    />
  );
}
