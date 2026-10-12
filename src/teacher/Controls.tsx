import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChatToggle } from "../chat/Chat";
import { endSession, handoff, setControl } from "../firebase/client";
import { DEFAULT_CHAT_LIMIT, type Mode, type Session } from "../firebase/types";
import { PulseButton } from "../pulse/Pulse";
import { routes } from "../routes";
import { TimerControls } from "../timer/TimerControls";
import { Groups } from "./Groups";
import { allowedModes, defaultsFor } from "./modes";
import { BlankIcon, ChatIcon, GridIcon, PersonIcon, WheelIcon } from "./icons";
import { Reveal } from "./Reveal";
import { Stepper } from "./Stepper";
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
const END_CONFIRM_MS = 3000;
const SPOTLIGHTS: Mode[] = ["spotlight", "anonymousSpotlight"];

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

/** The controls overlay and the thumbnail drawer. Toggled with Ctrl+. or Cmd+. */
export function Controls({
  session,
  data,
  wheelOpen,
  onWheel,
  onBlank,
  thumbsOpen,
  onThumbs,
  slideshow,
}: {
  session: string;
  data: Session;
  wheelOpen: boolean;
  onWheel: () => void;
  onBlank: () => void;
  thumbsOpen: boolean;
  onThumbs: () => void;
  /** Present only for an applet with slides. at is -1 before the first step. */
  slideshow?: {
    on: boolean;
    at: number;
    count: number;
    next?: string;
    onToggle: () => void;
  };
}) {
  const { manifest } = data.applet;
  const navigate = useNavigate();
  const control = data.control;
  const students = Object.keys(data.students ?? {});
  const online = students.filter((s) => data.presence?.[s]).length;
  const chatLimit = control.chatLimit ?? DEFAULT_CHAT_LIMIT;
  const [endArmed, setEndArmed] = useState(false);
  const allowed = allowedModes(data);
  const groups = MODE_GROUPS.map((g) =>
    g.filter(([m]) => !allowed || allowed.includes(m)),
  ).filter((g) => g.length > 0);
  const keyOrder = groups.flat().map(([m]) => m);
  const keys = useRef(keyOrder);
  keys.current = keyOrder;

  const latest = useRef(data);
  latest.current = data;
  // Spotlight waits for a student: choosing it only opens the picker, so screens change once, with someone on them.
  const [pending, setPending] = useState<Mode | null>(null);
  useEffect(() => setPending(null), [control.mode]);
  const pick = (mode: Mode) => {
    const current = latest.current.control.mode;
    if (SPOTLIGHTS.includes(mode) && !SPOTLIGHTS.includes(current))
      return setPending((p) => (p === mode ? null : mode));
    setPending(null);
    setControl(session, { mode, ...defaultsFor(mode, latest.current) });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: pick and keys read the latest values through refs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const i = "1234567890".indexOf(e.key);
      if (i < 0 || i >= keys.current.length) return;
      e.preventDefault();
      pick(keys.current[i]);
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
          <output
            aria-label="Students online"
            data-tip="Students online"
            className="stat"
          >
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
            data-tip="Student screens (G)"
            aria-pressed={thumbsOpen}
            onClick={onThumbs}
          >
            <GridIcon />
          </button>
          <button
            type="button"
            className="quiet icon-button"
            aria-label="Name wheel"
            data-tip="Name wheel"
            aria-pressed={wheelOpen}
            onClick={onWheel}
          >
            <WheelIcon />
          </button>
          {manifest.instructions !== undefined && (
            <ChatToggle className="quiet icon-button" />
          )}
          <button
            type="button"
            className="quiet icon-button"
            aria-label="Blank screen"
            data-tip="Blank screen"
            onClick={onBlank}
          >
            <BlankIcon />
          </button>
        </div>

        <div className="modes">
          {groups.map((group) => (
            <div key={group[0][0]} className="mode-group">
              {group.map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  data-mode={mode}
                  aria-pressed={control.mode === mode}
                  data-armed={pending === mode || undefined}
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
        {(pending || SPOTLIGHTS.includes(control.mode)) && (
          <SpotlightPicker session={session} data={data} pending={pending} />
        )}
        {control.mode === "group" && <Groups session={session} data={data} />}

        <div className="actions">
          {control.mode === "demo" && manifest.handoff !== false && (
            <button
              type="button"
              className="primary handoff"
              onClick={() => handoff(session, students)}
            >
              Handoff
            </button>
          )}
          {manifest.pulsePrompt !== undefined && (
            <PulseButton session={session} />
          )}
        </div>

        {slideshow && (
          <div className="slideshow">
            <div className="row">
              <button
                type="button"
                aria-pressed={slideshow.on}
                onClick={(e) => {
                  // Release focus so Space steps the slideshow instead of pressing this again.
                  e.currentTarget.blur();
                  slideshow.onToggle();
                }}
              >
                Slideshow
              </button>
              <output className="slideshow-at" aria-label="Slideshow step">
                Step {slideshow.at + 1} of {slideshow.count}
              </output>
            </div>
            {slideshow.next && (
              <p className="slideshow-next" aria-label="Next step">
                {slideshow.next}
              </p>
            )}
          </div>
        )}

        <TimerControls session={session} data={data} />

        <Stepper
          label={
            <span
              className="stepper-label"
              role="img"
              aria-label="Chats per minute"
              data-tip="Chats per minute"
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

/**
 * Every student by name. Tapping one spotlights them, tapping them again ends the spotlight.
 * With a spotlight mode pending, the first tap switches the class into it with that student.
 */
function SpotlightPicker({
  session,
  data,
  pending,
}: {
  session: string;
  data: Session;
  pending: Mode | null;
}) {
  const current = data.control.spotlight;
  const students = Object.entries(data.students ?? {}).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name),
  );
  return (
    <div className="choices spotlight-picker">
      {students.map(([uid, s]) => (
        <button
          key={uid}
          type="button"
          aria-pressed={!pending && current === uid}
          data-offline={!data.presence?.[uid] || undefined}
          onClick={() =>
            setControl(
              session,
              pending
                ? { mode: pending, spotlight: uid }
                : { spotlight: current === uid ? null : uid },
            )
          }
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}
