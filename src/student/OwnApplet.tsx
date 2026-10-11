import { AppletFrame } from "../applet/AppletFrame";
import { writeMyState } from "../firebase/client";
import type { StoredState, Student } from "../firebase/types";
import { useStudentState, useThrottledWriter } from "../hooks/session";

export interface StageProps {
  session: string;
  uid: string;
  me: Student;
  html: string;
}

export interface OwnProps {
  maxPhase?: number | null;
  interactive?: boolean;
}

/** Student's own applet, synced to their stored state. */
export function OwnApplet({
  session,
  uid,
  html,
  maxPhase = null,
  interactive = true,
}: StageProps & OwnProps) {
  const mine = useStudentState(session, uid);
  const write = useThrottledWriter((s: StoredState) =>
    writeMyState(session, s).catch(() => {}),
  );
  if (mine === undefined) return null;
  return (
    <AppletFrame
      html={html}
      state={mine}
      onUpdate={interactive ? write : undefined}
      maxPhase={maxPhase}
      interactive={interactive}
    />
  );
}
