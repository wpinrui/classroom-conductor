import { useEffect, useState, useSyncExternalStore } from "react";
import { TeacherStateContext } from "../applet/AppletFrame";
import { Chat } from "../chat/Chat";
import { useChatState } from "../chat/store";
import { setStage, setWheel } from "../firebase/client";
import { paths } from "../firebase/paths";
import type { Session } from "../firebase/types";
import { useAppletHtml, useSession } from "../hooks/session";
import { useAuth } from "../hooks/useAuth";
import { useValue } from "../hooks/useValue";
import { PulsePanel } from "../pulse/Pulse";
import { useShownPulse } from "../pulse/store";
import {
  spin,
  spinning,
  spotlightStudent,
  toggleOverlay,
  toggleWheel,
  useStageKeys,
} from "../stage/actions";
import {
  ChatLimit,
  End,
  JoinCode,
  Modes,
  Presence,
  Slideshow,
} from "../teacher/Controls";
import {
  BlankIcon,
  ChatIcon,
  ClassIcon,
  GridIcon,
  HandIcon,
  KeyboardIcon,
  QrIcon,
  ResetIcon,
  RulesIcon,
  SpotlightIcon,
  WheelIcon,
} from "../teacher/icons";
import { Library } from "../teacher/Library";
import { Thumb, Thumbnails } from "../teacher/Thumbnails";
import { wheelPools } from "../teacher/Wheel";
import { Countdown } from "../timer/Countdown";
import { ClockIcon } from "../timer/icons";
import { TimerControls } from "../timer/TimerControls";
import { remaining, useServerNow } from "../timer/timer";
import "../teacher/teacher.css";
import "./remote.css";

type Layout = "touch" | "laptop";
type Panel = "class" | "screens" | "wheel" | "timer" | "chat";

const LAYOUT_KEY = "remoteLayout";
const PHONE = "(max-width: 47.99rem)";

function initialLayout(): Layout {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (saved === "touch" || saved === "laptop") return saved;
  } catch {}
  const touch =
    matchMedia("(pointer: coarse)").matches &&
    !matchMedia("(hover: hover)").matches;
  return touch ? "touch" : "laptop";
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
  );
}

/** The remote: the library while no session is live, that session's controls while one is. */
export function Remote() {
  const user = useAuth();
  const current = useValue<string>(user ? paths.current(user.uid) : null);
  const [layout, setLayout] = useState(initialLayout);
  const switchLayout = () => {
    const next = layout === "touch" ? "laptop" : "touch";
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {}
  };
  if (current === undefined) return null;
  if (current === null)
    return (
      <div className="remote" data-layout={layout}>
        <Library touch={layout === "touch"} />
      </div>
    );
  return (
    <RemoteSession
      key={current}
      session={current}
      layout={layout}
      onLayout={switchLayout}
    />
  );
}

function RemoteSession({
  session,
  layout,
  onLayout,
}: {
  session: string;
  layout: Layout;
  onLayout: () => void;
}) {
  const data = useSession(session);
  const html = useAppletHtml(session, data?.applet.html);
  const phone = useMedia(PHONE);
  const touch = layout === "touch";
  const [tab, setTab] = useState<Panel>("class");
  // The right column's panel in the laptop and tablet layouts.
  const [side, setSide] = useState<Panel>("screens");
  const shownPulse = useShownPulse();
  const hasChat = data?.applet.manifest.instructions !== undefined;
  const panel = touch && phone ? tab : side;
  // A layout without chat cannot sit on it.
  const active: Panel = panel === "chat" && !hasChat ? "screens" : panel;

  useStageKeys(session, touch ? null : data, (e, d) => {
    if (shownPulse && e.key === "Escape") return true;
    if (e.key === "g" || e.key === "G") {
      setSide("screens");
      return true;
    }
    if ((e.key === " " || e.key === "Enter") && side === "wheel") {
      if (!spinning(d.stage ?? {})) spin(session, d.stage ?? {});
      return true;
    }
    return false;
  });

  if (!data || !html) return null;
  const stage = data.stage ?? {};

  const pulse = shownPulse && <PulsePanel session={session} />;
  const preview = <Preview data={data} html={html} />;
  const screens = (
    <Thumbnails session={session} data={data} html={html} touch={touch} />
  );
  const wheel = <WheelControls session={session} data={data} />;
  const timer = <TimerControls session={session} data={data} />;
  // Kept mounted, so an unread reply still marks the Chat tab.
  const chat = hasChat && (
    <Chat
      session={session}
      uid={data.teacher}
      teacher
      shown={active === "chat"}
    >
      <ChatLimit session={session} data={data} />
    </Chat>
  );
  const classGroup = (
    <>
      <Modes session={session} data={data} keys={!touch} />
      <Slideshow session={session} data={data} />
    </>
  );
  const choices: [Panel, string, React.ReactNode][] = [
    ["screens", "Screens", <GridIcon key="i" />],
    ["wheel", "Wheel", <WheelIcon key="i" />],
    ...(hasChat
      ? ([["chat", "Chat", <ChatIcon key="i" />]] as [
          Panel,
          string,
          React.ReactNode,
        ][])
      : []),
  ];
  const rightPanel = (
    <>
      {active === "screens" && screens}
      {active === "wheel" && wheel}
      {chat}
    </>
  );

  let body: React.ReactNode;
  if (touch && phone) {
    body = (
      <>
        <div className="remote-body">
          {active === "class" && (
            <div className="remote-column">
              {preview}
              {classGroup}
              <End session={session} data={data} />
            </div>
          )}
          {active === "screens" && screens}
          {active === "wheel" && wheel}
          {active === "timer" && <div className="remote-column">{timer}</div>}
          {chat}
          {pulse}
        </div>
        <TabBar data={data} tab={active} onTab={setTab} hasChat={hasChat} />
      </>
    );
  } else if (touch) {
    body = (
      <div className="remote-columns">
        <div className="remote-column remote-left">
          {classGroup}
          {timer}
          <End session={session} data={data} />
        </div>
        <div className="remote-right">
          {preview}
          <div className="segmented" role="tablist">
            {choices.map(([p, label, icon]) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={active === p}
                onClick={() => setSide(p)}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <div className="remote-panel">
            {rightPanel}
            {pulse}
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="remote-columns">
        <div className="remote-column remote-left">
          {classGroup}
          {timer}
          <End session={session} data={data} />
        </div>
        <div className="remote-right">
          <div className="remote-pick">
            {choices.map(([p, label, icon]) => (
              <button
                key={p}
                type="button"
                className="quiet icon-button"
                aria-label={label}
                data-tip={
                  p === "screens"
                    ? "Screens (G)"
                    : p === "wheel"
                      ? "Wheel"
                      : label
                }
                aria-pressed={active === p}
                onClick={() => setSide(p)}
              >
                {icon}
              </button>
            ))}
            {preview}
          </div>
          <div className="remote-panel">
            {rightPanel}
            {pulse}
          </div>
        </div>
      </div>
    );
  }

  return (
    <TeacherStateContext.Provider value={data.teacherState ?? null}>
      <div
        className="remote remote-live"
        data-layout={layout}
        data-phone={phone || undefined}
      >
        <header className="remote-top">
          <JoinCode
            data={data}
            onToggle={() => toggleOverlay(session, stage, "join")}
          />
          <Presence data={data} />
          {data.teacherTimer && <Countdown timer={data.teacherTimer} private />}
          <div className="projector-toggles">
            <ProjectorToggle
              label="Blank"
              tip="Blank (B)"
              pressed={!!stage.blank}
              danger
              onClick={() => toggleOverlay(session, stage, "blank")}
            >
              <BlankIcon />
            </ProjectorToggle>
            <ProjectorToggle
              label="Join"
              tip="Join screen (J)"
              pressed={!!stage.join}
              onClick={() => toggleOverlay(session, stage, "join")}
            >
              <QrIcon />
            </ProjectorToggle>
            <ProjectorToggle
              label="Rules"
              tip="Class rules (R)"
              pressed={!!stage.rules}
              onClick={() => toggleOverlay(session, stage, "rules")}
            >
              <RulesIcon />
            </ProjectorToggle>
          </div>
          <button
            type="button"
            className="quiet icon-button layout-switch"
            aria-label={touch ? "Laptop layout" : "Touch layout"}
            data-tip={touch ? "Laptop layout" : "Touch layout"}
            onClick={onLayout}
          >
            {touch ? <KeyboardIcon /> : <HandIcon />}
          </button>
        </header>
        {body}
      </div>
    </TeacherStateContext.Provider>
  );
}

/** An icon button for something on the projector. Touch shows its label under the icon. */
function ProjectorToggle({
  label,
  tip,
  pressed,
  danger,
  onClick,
  children,
}: {
  label: string;
  tip: string;
  pressed: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="quiet icon-button projector-toggle"
      aria-label={label}
      data-tip={tip}
      aria-pressed={pressed}
      data-danger={danger || undefined}
      onClick={onClick}
    >
      {children}
      <span className="touch-label">{label}</span>
    </button>
  );
}

/** What the class sees, view only: the teacher's applet with any spotlight on top. */
function Preview({ data, html }: { data: Session; html: string }) {
  const m = data.control.mode;
  const target =
    m === "spotlight" || m === "anonymousSpotlight"
      ? data.control.spotlight
      : undefined;
  return (
    <div className="preview" data-blank={data.stage?.blank || undefined}>
      <Thumb html={html} state={data.teacherState ?? null} owner="teacher" />
      {target && data.students?.[target] && (
        <div className="preview-spotlight">
          <Thumb html={html} state={data.states?.[target] ?? null} />
        </div>
      )}
    </div>
  );
}

/** The wheel's controls. The wheel itself draws on the projection. */
function WheelControls({ session, data }: { session: string; data: Session }) {
  const stage = data.stage ?? {};
  const { pool, replacement, anyDrawn, everyone, options } = wheelPools(data);
  const busy = spinning(stage) && !!stage.wheel?.open;
  const result = stage.wheel?.result;
  const winner =
    result && result.n === stage.wheel?.spin && result.uid
      ? result.uid
      : undefined;
  return (
    <section className="wheel-controls" aria-label="Name wheel">
      <div className="wheel-bar">
        <button
          type="button"
          className="icon-button"
          aria-label="Wheel on projector"
          data-tip="Wheel on projector (W)"
          aria-pressed={!!stage.wheel?.open}
          onClick={() => toggleWheel(session, stage)}
        >
          <WheelIcon />
        </button>
        {options.length > 1 &&
          options.map((o) => (
            <button
              key={o.name}
              type="button"
              className="wheel-pool"
              aria-pressed={pool === o.name}
              disabled={busy}
              onClick={() =>
                setStage(session, { "wheel/pool": o.name || null })
              }
            >
              {o.name || "Everyone"}
              <span className="wheel-count">{o.count}</span>
            </button>
          ))}
        <div className="wheel-settings">
          <button
            type="button"
            className="wheel-pool"
            aria-pressed={!replacement}
            onClick={() =>
              setWheel(session, { replacement: !replacement, teacherSet: true })
            }
          >
            No repeats
          </button>
          {anyDrawn && (
            <button
              type="button"
              className="quiet icon-button"
              aria-label="Put everyone back"
              data-tip="Put everyone back"
              disabled={busy}
              onClick={() => setWheel(session, { drawn: null })}
            >
              <ResetIcon />
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        className="primary wheel-spin"
        disabled={busy || everyone.length === 0}
        onClick={() => spin(session, stage)}
      >
        Spin
      </button>
      <div className="wheel-result">
        <output className="wheel-winner" aria-live="polite">
          {winner ? (data.students?.[winner]?.name ?? "") : ""}
        </output>
        {winner && (
          <button
            type="button"
            className="quiet icon-button"
            aria-label="Spotlight"
            data-tip="Spotlight"
            onClick={() => {
              spotlightStudent(session, data, winner);
              setStage(session, { "wheel/open": null });
            }}
          >
            <SpotlightIcon />
          </button>
        )}
      </div>
    </section>
  );
}

/** The phone's tabs. A dot marks a tab that needs the teacher. */
function TabBar({
  data,
  tab,
  onTab,
  hasChat,
}: {
  data: Session;
  tab: Panel;
  onTab: (p: Panel) => void;
  hasChat: boolean;
}) {
  const { unread } = useChatState();
  const timer = data.control.timer ?? data.teacherTimer;
  const now = useServerNow(timer?.endsAt !== undefined);
  const timerDone = !!timer && remaining(timer, now) === 0;
  // A Pulse that finished since the teacher last looked at Screens.
  const newestDone = Object.entries(data.pulses ?? {})
    .filter(([, p]) => p.status === "done")
    .reduce((a, [pid]) => (pid > a ? pid : a), "");
  const [seenPulse, setSeenPulse] = useState(newestDone);
  useEffect(() => {
    if (tab === "screens") setSeenPulse(newestDone);
  }, [tab, newestDone]);
  const tabs: [Panel, string, React.ReactNode, boolean][] = [
    ["class", "Class", <ClassIcon key="i" />, false],
    ["screens", "Screens", <GridIcon key="i" />, newestDone > seenPulse],
    ["wheel", "Wheel", <WheelIcon key="i" />, false],
    ["timer", "Timer", <ClockIcon key="i" />, timerDone],
  ];
  if (hasChat) tabs.push(["chat", "Chat", <ChatIcon key="i" />, unread]);
  return (
    <nav className="tab-bar">
      {tabs.map(([p, label, icon, dot]) => (
        <button
          key={p}
          type="button"
          aria-current={tab === p || undefined}
          onClick={() => onTab(p)}
        >
          <span className="tab-icon">
            {icon}
            {dot && <span className="dot accent tab-dot" />}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}
