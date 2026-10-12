import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  JOIN_CODE_LENGTH,
  JoinError,
  joinSession,
  resumeSession,
} from "../firebase/client";
import { routes } from "../routes";

/** Code and name entry. A rejected field is marked rather than explained. */
export function Join() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [bad, setBad] = useState<"code" | "name" | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // A student who already joined a running session goes straight back to it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: check once on arrival
  useEffect(() => {
    resumeSession()
      .catch(() => null)
      .then((session) => {
        if (session) navigate(routes.play(session), { replace: true });
        else setChecking(false);
      });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBad(null);
    try {
      navigate(routes.play(await joinSession(code, name)), { replace: true });
    } catch (err) {
      setBad(err instanceof JoinError ? err.reason : "code");
      setBusy(false);
    }
  };

  if (checking) return null;
  return (
    <main className="center">
      <form className="join" onSubmit={submit}>
        <input
          className="code-input"
          aria-label="Join code"
          placeholder="Code"
          aria-invalid={bad === "code"}
          maxLength={JOIN_CODE_LENGTH}
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
        />
        <input
          aria-label="Name"
          placeholder="Name"
          aria-invalid={bad === "name"}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" className="primary" disabled={busy}>
          Join
        </button>
      </form>
    </main>
  );
}
