import { AppletFrame } from "../applet/AppletFrame";
import { writeMyState } from "../firebase/client";
import type { Mode, StoredState, Student } from "../firebase/types";
import {
  useControl,
  useSessionApplet,
  useStudentState,
  useTeacherState,
  useThrottledWriter,
} from "../hooks/session";

export interface StageProps {
  session: string;
  uid: string;
  me: Student;
  html: string;
}

/** Student's own applet, editable, synced to their stored state. */
export function OwnApplet({ session, uid, html }: StageProps) {
  const mine = useStudentState(session, uid);
  const write = useThrottledWriter((s: StoredState) =>
    writeMyState(session, s).catch(() => {}),
  );
  if (mine === undefined) return null;
  return <AppletFrame html={html} state={mine} onUpdate={write} />;
}

/** Demo: the teacher's applet, live and view-only. */
export function DemoView({ session, html }: StageProps) {
  const teacher = useTeacherState(session);
  if (teacher === undefined) return null;
  return <AppletFrame html={html} state={teacher} interactive={false} />;
}

/** One view per mode. Modes without a view yet fall back to the student's own applet. */
const views: Partial<Record<Mode, (p: StageProps) => React.ReactNode>> = {
  demo: DemoView,
  independent: OwnApplet,
};

export function StudentStage({ session, uid, me }: Omit<StageProps, "html">) {
  const control = useControl(session);
  const applet = useSessionApplet(session);
  if (!control || !applet) return null;
  const View = views[control.mode] ?? OwnApplet;
  return (
    <main className="stage">
      <View session={session} uid={uid} me={me} html={applet.html} />
    </main>
  );
}
