import { Navigate, useParams } from "react-router";
import { paths } from "../firebase/paths";
import type { Student } from "../firebase/types";
import { usePresenceTracking } from "../hooks/session";
import { useAuth } from "../hooks/useAuth";
import { useValue } from "../hooks/useValue";
import { routes } from "../routes";
import { StudentStage } from "./StudentStage";

/** A joined student's view. Anyone not joined, or whose session has ended, is sent back to the join page. */
export function StudentSession() {
  const { session = "" } = useParams();
  const user = useAuth();
  const me = useValue<Student>(user ? paths.student(session, user.uid) : null);
  const live = useValue<boolean>(user ? paths.live(session) : null);
  const joined = Boolean(user && me && live);
  usePresenceTracking(joined ? session : null);

  if (user === undefined || me === undefined || live === undefined) return null;
  if (!user || !me || !live) return <Navigate to={routes.join} replace />;
  return <StudentStage session={session} uid={user.uid} me={me} />;
}
