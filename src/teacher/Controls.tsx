import { useNavigate } from "react-router";
import { endSession, handoff, setControl } from "../firebase/client";
import { MODES, type Session } from "../firebase/types";
import { routes } from "../routes";

/** The controls overlay. Toggled with Ctrl+. or Cmd+. */
export function Controls({
  session,
  data,
}: {
  session: string;
  data: Session;
}) {
  const navigate = useNavigate();
  const students = Object.keys(data.students ?? {});
  const online = Object.keys(data.presence ?? {}).length;

  const end = async () => {
    await endSession(session, data.code);
    navigate(routes.library);
  };

  return (
    <aside className="controls">
      <output className="join-code" aria-label="Join code">
        {data.code}
      </output>
      <output className="stat" aria-label="Students online">
        {online}/{students.length}
      </output>
      <div className="modes">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={data.control.mode === mode}
            onClick={() => setControl(session, { mode })}
          >
            {mode}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="primary"
        onClick={() => handoff(session, students)}
      >
        Handoff
      </button>
      <button type="button" className="quiet" onClick={end}>
        End
      </button>
    </aside>
  );
}
