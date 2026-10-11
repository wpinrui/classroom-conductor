import { Navigate, useParams } from "react-router";
import { paths } from "../firebase/paths";
import type { Student } from "../firebase/types";
import { usePresenceTracking } from "../hooks/session";
import { useAuth } from "../hooks/useAuth";
import { useValue } from "../hooks/useValue";
import { routes } from "../routes";
import { StudentStage } from "./StudentStage";

/** A joined student's view. Anyone not joined is sent back to the join page. */
export function StudentSession() {
  const { session = "" } = useParams();
  const user = useAuth();
  const me = useValue<Student>(user ? paths.student(session, user.uid) : null);
  const joined = Boolean(user && me);
  usePresenceTracking(joined ? session : null);

  if (user === null || me === null)
    return <Navigate to={routes.join} replace />;
  if (!user || !me) return null;
  return <StudentStage session={session} uid={user.uid} me={me} />;
}
