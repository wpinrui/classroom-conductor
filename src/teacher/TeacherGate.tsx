import { Outlet } from "react-router";
import { signInTeacher } from "../firebase/client";
import { useAuth } from "../hooks/useAuth";

/** Shows the teacher area only to a signed-in, non-anonymous user. */
export function TeacherGate() {
  const user = useAuth();
  if (user === undefined) return null;
  if (!user || user.isAnonymous)
    return (
      <main className="center">
        <button type="button" className="primary" onClick={signInTeacher}>
          Sign in with Google
        </button>
      </main>
    );
  return <Outlet />;
}
