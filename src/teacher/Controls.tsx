import { useNavigate } from "react-router";
import {
  endSession,
  handoff,
  requestPulse,
  setControl,
} from "../firebase/client";
import type { Control, Mode, Session } from "../firebase/types";
import { routes } from "../routes";
import { Groups } from "./Groups";
import { Reveal } from "./Reveal";
import { Thumbnails } from "./Thumbnails";

/** Anonymous Spotlight is Spotlight with the Anonymous toggle on, so it has no button. */
const MODE_LABELS: [Exclude<Mode, "anonymousSpotlight">, string][] = [
  ["demo", "Demo"],
  ["independent", "Independent"],
  ["spotlight", "Spotlight"],
  ["gallery", "Gallery"],
  ["group", "Group"],
  ["paced", "Paced"],
  ["reveal", "Reveal"],
  ["freeze", "Freeze"],
  ["focus", "Focus"],
];

const isSpotlight = (m: Mode) =>
  m === "spotlight" || m === "anonymousSpotlight";

/** Control fields a mode needs, filled in when it is first entered. */
function defaultsFor(mode: Mode, data: Session): Partial<Control> {
  const c = data.control;
  if (mode === "paced" && c.pacedPhase === undefined)
    return { pacedPhase: data.teacherState?.phase ?? 0 };
  if (mode === "reveal" && !c.reveal && data.teacherState)
    return { reveal: { ...data.teacherState, at: Date.now() } };
  return {};
}

/** The controls overlay. Toggled with Ctrl+. or Cmd+. */
export function Controls({
  session,
  data,
}: {
  session: string;
  data: Session;
}) {
  const navigate = useNavigate();
  const control = data.control;
  const students = Object.keys(data.students ?? {});
  const online = Object.keys(data.presence ?? {}).length;
  const classPulsePending = Object.values(data.pulses ?? {}).some(
    (p) => !p.student && p.status === "pending",
  );

  const pick = (mode: Mode) => {
    if (isSpotlight(mode) && isSpotlight(control.mode)) return;
    setControl(session, { mode, ...defaultsFor(mode, data) });
  };

  const end = async () => {
    await endSession(session, data.code);
    navigate(routes.library);
  };

  return (
    <aside className="controls">
      <header className="controls-head">
        <output className="join-code" aria-label="Join code">
          {data.code}
        </output>
        <output className="stat" aria-label="Students online">
          {online}/{students.length}
        </output>
      </header>

      <div className="modes">
        {MODE_LABELS.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={
              mode === "spotlight"
                ? isSpotlight(control.mode)
                : control.mode === mode
            }
            onClick={() => pick(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      {control.mode === "demo" && (
        <button
          type="button"
          className="primary"
          onClick={() => handoff(session, students)}
        >
          Handoff
        </button>
      )}
      {isSpotlight(control.mode) && (
        <button
          type="button"
          aria-pressed={control.mode === "anonymousSpotlight"}
          onClick={() =>
            setControl(session, {
              mode:
                control.mode === "anonymousSpotlight"
                  ? "spotlight"
                  : "anonymousSpotlight",
            })
          }
        >
          Anonymous
        </button>
      )}
      {control.mode === "paced" && <Paced session={session} data={data} />}
      {control.mode === "reveal" && <Reveal session={session} data={data} />}
      {control.mode === "group" && <Groups session={session} data={data} />}

      <div className="row">
        <button
          type="button"
          disabled={classPulsePending}
          onClick={() => requestPulse(session)}
        >
          Pulse
        </button>
        <label className="field">
          Chats per minute
          <input
            type="number"
            min={0}
            value={control.chatLimit ?? ""}
            onChange={(e) =>
              setControl(session, {
                chatLimit:
                  e.target.value === "" ? null : Math.max(0, +e.target.value),
              })
            }
          />
        </label>
      </div>

      <Thumbnails session={session} data={data} />

      <button type="button" className="quiet" onClick={end}>
        End
      </button>
    </aside>
  );
}

/** Steps the phase everyone is held to. */
function Paced({ session, data }: { session: string; data: Session }) {
  const phases = data.applet.manifest.phases;
  const at = Math.min(data.control.pacedPhase ?? 0, phases.length - 1);
  const go = (pacedPhase: number) => setControl(session, { pacedPhase });
  return (
    <div className="stepper">
      <button
        type="button"
        aria-label="Previous phase"
        disabled={at <= 0}
        onClick={() => go(at - 1)}
      >
        ‹
      </button>
      <output>{phases[at]}</output>
      <button
        type="button"
        aria-label="Next phase"
        disabled={at >= phases.length - 1}
        onClick={() => go(at + 1)}
      >
        ›
      </button>
    </div>
  );
}
