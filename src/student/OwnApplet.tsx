import { AppletFrame } from "../applet/AppletFrame";
import { writeMyState } from "../firebase/client";
import type { StoredState, Student } from "../firebase/types";
import { useStudentState, useThrottledWriter } from "../hooks/session";
import { Loading } from "./Cues";

export interface StageProps {
  session: string;
  uid: string;
  me: Student;
  html: string;
}

/** Student's own applet, synced to their stored state. It answers the teacher's Reset. */
export function OwnApplet({
  session,
  uid,
  html,
  reset,
}: StageProps & { reset?: number }) {
  const mine = useStudentState(session, uid);
  const write = useThrottledWriter((s: StoredState) =>
    writeMyState(session, s).catch(() => {}),
  );
  if (mine === undefined) return <Loading />;
  return (
    <AppletFrame html={html} state={mine} onUpdate={write} reset={reset} />
  );
}
