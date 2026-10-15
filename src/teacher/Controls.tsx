import { useEffect, useRef, useState } from "react";
import type { AppletControl } from "../applet/contract";
import { endSession, handoff, setControl } from "../firebase/client";
import { DEFAULT_CHAT_LIMIT, type Mode, type Session } from "../firebase/types";
import { sendControl, stepSlideshow, toggleSlideshow } from "../stage/actions";
import { Groups } from "./Groups";
import { ChatIcon, CopyIcon, PersonIcon, SendIcon } from "./icons";
import { allowedModes, defaultsFor, handoffAllowed } from "./modes";
import { Reveal } from "./Reveal";
import { Stepper } from "./Stepper";
import "./teacher.css";

// The remote's class controls, one component per group in docs/design.md's Left column order.

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
const COPIED_MS = 1500;
const SPOTLIGHTS: Mode[] = ["spotlight", "anonymousSpotlight"];

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

/** The join code. Tapping it puts the join screen on the projector. */
export function JoinCode({
  data,
  onToggle,
}: {
  data: Session;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(data.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    });
  return (
    <div className="join-row">
      <button
        type="button"
        className="quiet join-code"
        aria-label="Join screen"
        data-tip="Join screen (J)"
        aria-pressed={!!data.stage?.join}
        onClick={onToggle}
      >
        {data.code}
      </button>
      <button
        type="button"
        className="quiet icon-button"
        aria-label="Copy code"
        data-tip={copied ? "Copied" : "Copy code"}
        onClick={copy}
      >
        <CopyIcon />
      </button>
    </div>
  );
}

/** Online over joined, with a success dot once everyone joined is online. */
export function Presence({ data }: { data: Session }) {
  const students = Object.keys(data.students ?? {});
  const online = students.filter((s) => data.presence?.[s]).length;
  return (
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
  );
}

/**
 * The mode switcher and the detail the active mode needs. Spotlight waits for a student:
 * choosing it only opens the picker, so screens change once, with someone on them.
 */
export function Modes({
  session,
  data,
  keys,
}: {
  session: string;
  data: Session;
  /** True when 1 to 9 and 0 switch modes. */
  keys: boolean;
}) {
  const control = data.control;
  const allowed = allowedModes(data);
  const groups = MODE_GROUPS.map((g) =>
    g.filter(([m]) => !allowed || allowed.includes(m)),
  ).filter((g) => g.length > 0);
  const keyOrder = groups.flat().map(([m]) => m);
  const order = useRef(keyOrder);
  order.current = keyOrder;
  const latest = useRef(data);
  latest.current = data;
  const [pending, setPending] = useState<Mode | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a mode change settles any pending spotlight
  useEffect(() => setPending(null), [control.mode]);
  const pick = (mode: Mode) => {
    const current = latest.current.control.mode;
    if (SPOTLIGHTS.includes(mode) && !SPOTLIGHTS.includes(current))
      return setPending((p) => (p === mode ? null : mode));
    setPending(null);
    setControl(session, { mode, ...defaultsFor(mode, latest.current) });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: pick and order read the latest values through refs
  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const i = "1234567890".indexOf(e.key);
      if (i < 0 || i >= order.current.length) return;
      e.preventDefault();
      pick(order.current[i]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, keys]);

  return (
    <>
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
      <AppletControls session={session} data={data} />
      {control.mode === "paced" && <Paced session={session} data={data} />}
      {control.mode === "reveal" && <Reveal session={session} data={data} />}
      {(pending || SPOTLIGHTS.includes(control.mode)) && (
        <SpotlightPicker
          session={session}
          data={data}
          pending={pending}
          focus={keys}
        />
      )}
      {control.mode === "group" && <Groups session={session} data={data} />}
      {control.mode === "demo" && handoffAllowed(data) && (
        <button
          type="button"
          className="primary handoff"
          onClick={() => handoff(session, Object.keys(data.students ?? {}))}
        >
          Handoff
        </button>
      )}
    </>
  );
}

/** The applet's own teacher controls, drawn with the Conductor's components. */
function AppletControls({ session, data }: { session: string; data: Session }) {
  let controls: AppletControl[] = [];
  try {
    controls = JSON.parse(data.stage?.controls ?? "[]");
  } catch {}
  if (!Array.isArray(controls) || controls.length === 0) return null;
  const send = (id: string, value?: boolean | string) =>
    sendControl(session, data.stage ?? {}, id, value);
  return (
    <div className="applet-controls">
      {controls.map((c) =>
        c.kind === "text" ? (
          <TextControl key={c.id} control={c} onSend={(v) => send(c.id, v)} />
        ) : (
          <button
            key={c.id}
            type="button"
            disabled={c.disabled}
            aria-pressed={c.kind === "toggle" ? c.value === true : undefined}
            onClick={() =>
              c.kind === "toggle" ? send(c.id, c.value !== true) : send(c.id)
            }
          >
            {c.label}
          </button>
        ),
      )}
    </div>
  );
}

function TextControl({
  control,
  onSend,
}: {
  control: AppletControl;
  onSend: (value: string) => void;
}) {
  const value = typeof control.value === "string" ? control.value : "";
  const [draft, setDraft] = useState(value);
  // A new value from the applet replaces the draft.
  useEffect(() => setDraft(value), [value]);
  return (
    <form
      className="text-control"
      onSubmit={(e) => {
        e.preventDefault();
        onSend(draft);
      }}
    >
      <input
        aria-label={control.label}
        placeholder={control.label}
        disabled={control.disabled}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="submit"
        className="primary icon-button"
        aria-label="Send"
        disabled={control.disabled}
      >
        <SendIcon />
      </button>
    </form>
  );
}

/** The slideshow toggle, where it is, what is next, and large Previous and Next buttons while it is on. */
export function Slideshow({
  session,
  data,
}: {
  session: string;
  data: Session;
}) {
  const slides = data.applet.manifest.slides ?? [];
  if (slides.length === 0) return null;
  const show = data.stage?.slideshow ?? {};
  const at = Math.min(show.at ?? -1, slides.length - 1);
  const next = slides[at + 1]?.label;
  const step = (dir: 1 | -1) => stepSlideshow(session, data.stage ?? {}, dir);
  return (
    <div className="slideshow">
      <div className="row">
        <button
          type="button"
          aria-pressed={!!show.on}
          data-tip="Slideshow (S)"
          onClick={(e) => {
            // Release focus so Space steps the slideshow instead of pressing this again.
            e.currentTarget.blur();
            toggleSlideshow(session, data);
          }}
        >
          Slideshow
        </button>
        <output className="slideshow-at" aria-label="Slideshow step">
          Step {at + 1} of {slides.length}
        </output>
      </div>
      {next && <p className="slideshow-next">{next}</p>}
      {show.on && (
        <div className="slideshow-steps">
          <button
            type="button"
            aria-label="Previous step"
            disabled={at <= 0}
            onClick={(e) => {
              e.currentTarget.blur();
              step(-1);
            }}
          >
            ←
          </button>
          <button
            type="button"
            className="primary"
            aria-label="Next step"
            disabled={at >= slides.length - 1}
            onClick={(e) => {
              e.currentTarget.blur();
              step(1);
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

/** Chat messages per student per minute. 0 shows as ∞. */
export function ChatLimit({
  session,
  data,
}: {
  session: string;
  data: Session;
}) {
  const chatLimit = data.control.chatLimit ?? DEFAULT_CHAT_LIMIT;
  return (
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
  );
}

/** Quiet until armed by the first click. A second click within 3 seconds ends the session. */
export function End({ session, data }: { session: string; data: Session }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), END_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={armed ? "end armed" : "quiet end"}
      onClick={() => (armed ? endSession(session, data.code) : setArmed(true))}
    >
      End
    </button>
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
  focus,
}: {
  session: string;
  data: Session;
  pending: Mode | null;
  /** Focus the search on open. Off on touch, where it would raise the keyboard. */
  focus: boolean;
}) {
  const current = data.control.spotlight;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const students = Object.entries(data.students ?? {})
    .filter(([, s]) => !q || s.name.toLowerCase().includes(q))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));
  const pick = (uid: string) =>
    setControl(
      session,
      pending
        ? { mode: pending, spotlight: uid }
        : { spotlight: current === uid ? null : uid },
    );
  return (
    <div className="spotlight-picker">
      <input
        type="search"
        className="spotlight-search"
        aria-label="Search students"
        placeholder="Search"
        // biome-ignore lint/a11y/noAutofocus: choosing Spotlight is a request to pick someone
        autoFocus={focus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter spotlights the first match.
          if (e.key === "Enter" && students[0]) pick(students[0][0]);
        }}
      />
      <div className="choices">
        {students.map(([uid, s]) => (
          <button
            key={uid}
            type="button"
            aria-pressed={!pending && current === uid}
            data-offline={!data.presence?.[uid] || undefined}
            onClick={() => pick(uid)}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
