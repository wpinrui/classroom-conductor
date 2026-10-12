import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { isTeacher, signInTeacher } from "../firebase/client";
import { useAuth } from "../hooks/useAuth";

/** Shows the teacher area only to an allowlisted Google account. */
export function TeacherGate() {
  const user = useAuth();
  const [allowed, setAllowed] = useState<{ uid: string; ok: boolean }>();
  const uid = user && !user.isAnonymous ? user.uid : undefined;
  useEffect(() => {
    if (uid) isTeacher(uid).then((ok) => setAllowed({ uid, ok }));
  }, [uid]);
  if (user === undefined) return null;
  const ok = uid && allowed?.uid === uid ? allowed.ok : undefined;
  if (uid && ok === undefined) return null;
  if (!ok)
    return (
      <main className="center">
        {uid && <p>This account can't teach here.</p>}
        <button type="button" className="primary" onClick={signInTeacher}>
          Sign in with Google
        </button>
      </main>
    );
  return <Outlet />;
}
