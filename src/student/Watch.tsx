import { AppletFrame } from "../applet/AppletFrame";
import { paths } from "../firebase/paths";
import type { Student } from "../firebase/types";
import { useStudentState } from "../hooks/session";
import { useValue } from "../hooks/useValue";
import { Loading } from "./Cues";

/** Another student's applet, view-only. */
export function Screen({
  session,
  html,
  student,
}: {
  session: string;
  html: string;
  student: string;
}) {
  const state = useStudentState(session, student);
  if (state === undefined) return <Loading />;
  return <AppletFrame html={html} state={state} interactive={false} />;
}

export function useName(session: string, student: string | null) {
  return useValue<Student>(student && paths.student(session, student))?.name;
}
