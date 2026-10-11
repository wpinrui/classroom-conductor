import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChatToggle } from "../chat/Chat";
import { endSession, handoff, setControl } from "../firebase/client";
import {
  type Control,
  DEFAULT_CHAT_LIMIT,
  type Mode,
  type Session,
} from "../firebase/types";
import { PulseButton } from "../pulse/Pulse";
import { routes } from "../routes";
import { Groups } from "./Groups";
import { ChatIcon, GridIcon, PersonIcon } from "./icons";
import { Reveal } from "./Reveal";
import { Stepper } from "./Stepper";
import { Thumbnails } from "./Thumbnails";
import "./teacher.css";

/** Watch, Work and Stop groups, in switcher and number-key order. */
const MODE_GROUPS: [Mode, string][][] = [
  [
    ["demo", "Demo"],
    ["reveal", "Reveal"],
    ["spotlight", "Spotlight"],
    ["anonymousSpotlight", "Anonymous"],
    ["gallery", "Gallery"],
  ],
  [
    ["independent", "Independent"],
    ["paced", "Paced"],
    ["group", "Group"],
  ],
  [
    ["freeze", "Freeze"],
    ["focus", "Focus"],
  ],
];
const KEY_ORDER = MODE_GROUPS.flat().map(([m]) => m);
const END_CONFIRM_MS = 3000;

/** Control fields a mode needs, filled in when it is first entered. */
function defaultsFor(mode: Mode, data: Session): Partial<Control> {
  const c = data.control;
  if (mode === "paced" && c.pacedPhase === undefined)
    return { pacedPhase: data.teacherState?.phase ?? 0 };
  if (mode === "reveal" && !c.reveal && data.teacherState)
    return { reveal: { ...data.teacherState, at: Date.now() } };
  return {};
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

/** The controls overlay and the thumbnail drawer. Toggled with Ctrl+. or Cmd+. */
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
  const online = students.filter((s) => data.presence?.[s]).length;
  const chatLimit = control.chatLimit ?? DEFAULT_CHAT_LIMIT;
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [endArmed, setEndArmed] = useState(false);

  const latest = useRef(data);
  latest.current = data;
  const pick = (mode: Mode) =>
    setControl(session, { mode, ...defaultsFor(mode, latest.current) });

  // biome-ignore lint/correctness/useExhaustiveDependencies: pick reads the latest data through a ref
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const i = "1234567890".indexOf(e.key);
      if (i < 0 || i >= KEY_ORDER.length) return;
      e.preventDefault();
      pick(KEY_ORDER[i]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  useEffect(() => {
    if (!endArmed) return;
    const t = setTimeout(() => setEndArmed(false), END_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [endArmed]);

  const end = async () => {
    if (!endArmed) return setEndArmed(true);
    await endSession(session, data.code);
    navigate(routes.library);
  };

  return (
    <>
      <aside className="controls">
        <output className="join-code" aria-label="Join code">
          {data.code}
        </output>

        <div className="presence">
          <output aria-label="Students online" className="stat">
            <PersonIcon />
            {online}/{students.length}
            {students.length > 0 && online === students.length && (
              <span className="dot success" />
            )}
          </output>
          <button
            type="button"
            className="quiet icon-button"
            aria-label="Student screens"
            aria-pressed={thumbsOpen}
            onClick={() => setThumbsOpen((o) => !o)}
          >
            <GridIcon />
          </button>
          <ChatToggle className="quiet icon-button" />
        </div>

        <div className="modes">
          {MODE_GROUPS.map((group) => (
            <div key={group[0][0]} className="mode-group">
              {group.map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  data-mode={mode}
                  aria-pressed={control.mode === mode}
                  onClick={() => pick(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {control.mode === "paced" && <Paced session={session} data={data} />}
        {control.mode === "reveal" && <Reveal session={session} data={data} />}
        {control.mode === "group" && <Groups session={session} data={data} />}

        <div className="actions">
          <button
            type="button"
            className="primary handoff"
            onClick={() => handoff(session, students)}
          >
            Handoff
          </button>
          <PulseButton session={session} />
        </div>

        <Stepper
          label={
            <span
              className="stepper-label"
              role="img"
              aria-label="Chats per minute"
            >
              <ChatIcon />
            </span>
          }
          value={chatLimit === 0 ? "∞" : chatLimit}
          current={chatLimit}
          min={0}
          onStep={(d) => setControl(session, { chatLimit: chatLimit + d })}
        />

        <button
          type="button"
          className={endArmed ? "end armed" : "quiet end"}
          onClick={end}
        >
          End
        </button>
      </aside>
      {thumbsOpen && <Thumbnails session={session} data={data} />}
    </>
  );
}

/** Steps the phase everyone is held to, by the applet's phase names. */
function Paced({ session, data }: { session: string; data: Session }) {
  const phases = data.applet.manifest.phases;
  const at = Math.min(data.control.pacedPhase ?? 0, phases.length - 1);
  return (
    <Stepper
      value={phases[at]}
      current={at}
      min={0}
      max={phases.length - 1}
      onStep={(d) => setControl(session, { pacedPhase: at + d })}
    />
  );
}
