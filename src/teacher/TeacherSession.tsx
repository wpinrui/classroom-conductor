import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { AppletFrame } from "../applet/AppletFrame";
import { writeTeacherState } from "../firebase/client";
import type { Session, StoredState } from "../firebase/types";
import { useSession, useThrottledWriter } from "../hooks/session";
import { PulsePanel } from "../pulse/Pulse";
import { Controls } from "./Controls";

/** The teacher's live view: their own applet with the controls overlaid. */
export function TeacherSession() {
  const { session = "" } = useParams();
  const data = useSession(session);
  const [controlsOpen, setControlsOpen] = useState(true);
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
      <TeacherApplet
        data={data}
        onUpdate={write}
        onShortcut={() => setControlsOpen((o) => !o)}
      />
      {controlsOpen && <Controls session={session} data={data} />}
      <PulsePanel session={session} />
    </main>
  );
}

/** Mounts once per session so later teacherState echoes do not reset the applet. */
function TeacherApplet({
  data,
  onUpdate,
  onShortcut,
}: {
  data: Session;
  onUpdate: (s: StoredState) => void;
  onShortcut: () => void;
}) {
  const [initial] = useState(data.teacherState ?? null);
  return (
    <AppletFrame
      html={data.applet.html}
      state={initial}
      onUpdate={onUpdate}
      onShortcut={onShortcut}
    />
  );
}
