import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { AppletFrame, TeacherStateContext } from "../applet/AppletFrame";
import {
  type AppletControl,
  type ClassMember,
  preparedJson,
  type SlideCue,
  type WheelFilter,
  type WheelOptions,
} from "../applet/contract";
import { Chat } from "../chat/Chat";
import {
  setControl,
  setStage,
  setWheel,
  writeStudentState,
  writeTeacherState,
} from "../firebase/client";
import { paths } from "../firebase/paths";
import type { Session, StoredState } from "../firebase/types";
import {
  useAppletHtml,
  useSession,
  useThrottledWriter,
} from "../hooks/session";
import { useAuth } from "../hooks/useAuth";
import { useValue } from "../hooks/useValue";
import { PulsePanel } from "../pulse/Pulse";
import { useShownPulse } from "../pulse/store";
import {
  spin,
  spinning,
  spotlightStudent,
  stepSlideshow,
  toggleOverlay,
  toggleSlideshow,
  toggleWheel,
  useStageKeys,
} from "../stage/actions";
import { Countdown } from "../timer/Countdown";
import { TimerControls } from "../timer/TimerControls";
import { scriptTimer } from "../timer/timer";
import { End, JoinCode, Modes, Presence, Slideshow } from "./Controls";
import {
  BlankIcon,
  ChatIcon,
  GridIcon,
  QrIcon,
  RulesIcon,
  WheelIcon,
} from "./icons";
import { slideMode, teacherPhase } from "./modes";
import {
  type SlideEffect,
  slideCues,
  slideEffect,
  wheelGesture,
} from "./slides";
import { Thumbnails } from "./Thumbnails";
import { Wheel } from "./Wheel";
import "./teacher.css";

type SlideMessage = { phase: number; cues: SlideCue[]; n: number };

/** The projection: follows the teacher's live session, and shows bare background when there is none. */
export function Projection() {
  const user = useAuth();
  const current = useValue<string>(user ? paths.current(user.uid) : null);
  if (!current) return <main className="stage" />;
  return <TeacherSession key={current} session={current} />;
}

/** A deep link to one session's projection. */
export function ProjectionLink() {
  const { session = "" } = useParams();
  return <TeacherSession key={session} session={session} />;
}

/** The value a counter held when the page first saw it, so requests made before the page opened are not replayed. */
function useSeen(n: number | undefined, loaded: boolean) {
  const seen = useRef<number | null>(null);
  if (seen.current === null && loaded) seen.current = n ?? 0;
  return seen;
}

/** What the class sees on the big screen: the teacher's applet and whatever the remote puts over it. */
function TeacherSession({ session }: { session: string }) {
  const data = useSession(session);
  const stage = data?.stage ?? {};
  const [wheelPick, setWheelPick] = useState<{
    student: string;
    n: number;
  } | null>(null);
  const latestData = useRef(data);
  latestData.current = data;

  /** The applet drives the name wheel. The teacher can still close or change it from the remote. */
  const onWheel = (raw: unknown) => {
    const d = latestData.current;
    if (typeof raw !== "object" || raw === null || !d) return;
    const o = raw as WheelOptions;
    // Once the teacher has chosen, the applet's choice no longer applies.
    if (typeof o.replacement === "boolean" && !d.control.wheel?.teacherSet)
      setWheel(session, { replacement: o.replacement });
    if (o.open === false && !o.spin)
      return setStage(session, { "wheel/open": null });
    const patch: Record<string, unknown> = {};
    if (typeof o.filter === "string") patch["wheel/pool"] = o.filter || null;
    if (o.open || o.spin) patch["wheel/open"] = true;
    if (o.spin) patch["wheel/spin"] = (d.stage?.wheel?.spin ?? 0) + 1;
    if (Object.keys(patch).length > 0) setStage(session, patch);
  };

  /** Publishes the applet's filters for the remote, writing only when they change. */
  const onFilters = (f: WheelFilter[]) => {
    const json = JSON.stringify(f);
    if (latestData.current?.stage?.wheel?.filters !== json)
      setStage(session, { "wheel/filters": json });
  };
  const onControls = (c: AppletControl[]) => {
    const json = c.length > 0 ? JSON.stringify(c) : null;
    if ((latestData.current?.stage?.controls ?? null) !== json)
      setStage(session, { controls: json });
  };

  // Slideshow: the remote asks for steps. Going back re-applies a step, it never undoes one.
  const slides = data?.applet.manifest.slides ?? [];
  const slideshowOn = !!stage.slideshow?.on;
  const cursor = useRef(-1);
  const [slide, setSlide] = useState<SlideMessage | null>(null);
  // A state the projection pushes into the teacher's applet, such as an old slide's reveal.
  const [pushed, setPushed] = useState<StoredState | null>(null);

  /** Sets the mode a step leaves in force. An old reveal step loads its prepared state into the teacher's applet. */
  const applySlideMode = (effect: SlideEffect, d: Session) => {
    if (effect.reveal !== undefined) {
      const p = d.applet.manifest.preparedStates?.find(
        (x) => x.name === effect.reveal,
      );
      if (!p) return;
      const state = { json: preparedJson(p), phase: p.phase, at: Date.now() };
      setControl(session, { mode: "demo", dark: null });
      // After the step's own slide message, so its phase does not move the applet off the reveal.
      setTimeout(() => {
        setPushed(state);
        writeTeacherState(session, state);
      });
      return;
    }
    if (effect.mode) setControl(session, slideMode(effect.mode));
  };

  const stepSlide = (dir: 1 | -1) => {
    const d = latestData.current;
    if (!d || slides.length === 0) return;
    const k = Math.min(cursor.current, slides.length - 1) + dir;
    if (k < 0 || k >= slides.length) return;
    cursor.current = k;
    const patch: Record<string, unknown> = { "slideshow/at": k };
    // The wheel belongs to the step that spun it. Any other step puts it away.
    if (!slides[k].wheel) patch["wheel/open"] = null;
    setStage(session, patch);
    const forward = dir === 1;
    const effect = slideEffect(slides, k);
    const target = effect.phase ?? teacherPhase(d);
    const cues = slideCues(slides, k, forward);
    setSlide((m) => ({ phase: target, cues, n: (m?.n ?? 0) + 1 }));
    applySlideMode(effect, d);
    if (!forward) return;
    const s = slides[k];
    if (s.wheel) onWheel(s.wheel);
    if (s.timer !== undefined)
      scriptTimer(session, s.timer, s.timerShared ?? true);
  };

  // The cursor follows the database, so every remote and a reload agree on it.
  const at = stage.slideshow?.at;
  useEffect(() => {
    cursor.current = at ?? -1;
  }, [at]);

  // Each step request is applied once, in the order it arrives.
  const loaded = data !== undefined && data !== null;
  const stepN = stage.slideshow?.step?.n;
  const seenStep = useSeen(stepN, loaded);
  const stepRef = useRef(stepSlide);
  stepRef.current = stepSlide;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per step request
  useEffect(() => {
    const req = latestData.current?.stage?.slideshow?.step;
    if (!req || seenStep.current === null || req.n <= seenStep.current) return;
    seenStep.current = req.n;
    stepRef.current(req.dir);
  }, [stepN, seenStep]);

  // A control use from the remote reaches the applet once.
  const controlN = stage.control?.n;
  const seenControl = useSeen(controlN, loaded);
  const fresh =
    stage.control && seenControl.current !== null
      ? stage.control.n > seenControl.current
        ? stage.control
        : null
      : null;

  // The optional controls overlay: the laptop remote's left column, floating over the projection.
  // It starts hidden on every load, so the projector shows no controls unless the teacher asks.
  const [overlay, setOverlay] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const shownPulse = useShownPulse();
  const toggleOverlayPanel = () => setOverlay((o) => !o);

  const pressKey = useStageKeys(session, data, (e, d) => {
    if (e.key === "Escape" && shownPulse) return true;
    if (!overlay) return false;
    if (e.key === "g" || e.key === "G") {
      setDrawer((o) => !o);
      return true;
    }
    if ((e.key === " " || e.key === "Enter") && d.stage?.wheel?.open) {
      if (!spinning(d.stage)) spin(session, d.stage);
      return true;
    }
    return false;
  });
  const frameKey = (key: string) => {
    if (key === "g") {
      if (overlay) setDrawer((o) => !o);
    } else pressKey(key);
  };

  // Ctrl+., Cmd+. or the middle mouse button toggles the overlay. Clicks inside the applet arrive through the bridge.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        e.preventDefault();
        setOverlay((o) => !o);
      }
    };
    const onMiddle = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      setOverlay((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMiddle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMiddle);
    };
  }, []);

  // Clicking the lesson itself tucks the overlay away.
  useEffect(() => {
    if (!overlay) return;
    const inFrame = () => document.activeElement instanceof HTMLIFrameElement;
    // Reopened from inside the applet: release its focus so the next click in it registers.
    if (inFrame()) (document.activeElement as HTMLElement).blur();
    const onBlur = () =>
      setTimeout(() => {
        if (inFrame()) setOverlay(false);
      });
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (
        t instanceof Element &&
        (t.matches("main.stage, iframe") || t.closest(".teacher-spotlight"))
      )
        setOverlay(false);
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [overlay]);

  // The scroll wheel steps the slideshow while it is on.
  useEffect(() => {
    const gesture = wheelGesture();
    const onWheelEvent = (e: WheelEvent) => {
      const d = latestData.current;
      if (!d?.stage?.slideshow?.on) return;
      e.preventDefault();
      const dir = gesture(e);
      if (dir !== 0) stepSlideshow(session, d.stage, dir);
    };
    window.addEventListener("wheel", onWheelEvent, { passive: false });
    return () => window.removeEventListener("wheel", onWheelEvent);
  }, [session]);

  const write = useThrottledWriter((s: StoredState) =>
    writeTeacherState(session, s),
  );

  // While the join screen, the rules or a blank is up, any key or click takes it down.
  const covered = !!(stage.blank || stage.join || stage.rules);
  useEffect(() => {
    if (!covered) return;
    // Pull focus out of the applet, so the next key reaches the page.
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      setStage(session, { blank: null, join: null, rules: null });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [covered, session]);
  const uncover = () =>
    setStage(session, { blank: null, join: null, rules: null });

  const html = useAppletHtml(session, data?.applet.html);
  if (data === null || data?.ended) return <main className="stage" />;
  if (!data || !html) return null;
  const target = data.control.spotlight;
  const spotlit = target ? data.states?.[target] : undefined;
  return (
    <main className="stage" data-overlay={overlay || undefined}>
      <TeacherStateContext.Provider value={data.teacherState ?? null}>
        <TeacherApplet
          data={data}
          html={html}
          pushed={pushed}
          onUpdate={write}
          onConnect={({ reset }) => {
            if (!!latestData.current?.stage?.canReset !== reset)
              setStage(session, { canReset: reset || null });
          }}
          onFilters={onFilters}
          onControls={onControls}
          control={fresh}
          onTimer={(seconds, shared) => scriptTimer(session, seconds, shared)}
          onWheel={onWheel}
          onSpotlight={(raw) =>
            spotlightStudent(
              session,
              data,
              typeof raw === "string" ? raw : null,
            )
          }
          wheelPick={wheelPick}
          slideshow={slides.length > 0 ? slideshowOn : undefined}
          slide={slide}
          onStep={(dir) => {
            const d = latestData.current;
            if (d) stepSlideshow(session, d.stage ?? {}, dir);
          }}
          onSlideshowToggle={() => {
            const d = latestData.current;
            if (d) toggleSlideshow(session, d);
          }}
          onHotkey={frameKey}
          onShortcut={toggleOverlayPanel}
        />
        {target && data.students?.[target] && (
          <div className="teacher-spotlight">
            <SpotlitApplet
              key={target}
              session={session}
              student={target}
              html={html}
              state={spotlit}
            />
          </div>
        )}
        <div className="status-bar">
          {/* The projector shows this screen, so it says only what students would see. */}
          {target && data.students?.[target] && (
            <output className="status" data-tone="watch">
              <span>
                Viewing <b>{data.students[target].name}'s</b> screen
              </span>
            </output>
          )}
          {data.control.timer && <Countdown timer={data.control.timer} />}
        </div>
        {overlay && (
          <aside className="controls">
            <JoinCode
              data={data}
              onToggle={() => toggleOverlay(session, stage, "join")}
            />
            <div className="presence">
              <Presence data={data} />
              <button
                type="button"
                className="quiet icon-button"
                aria-label="Blank"
                data-tip="Blank (B)"
                aria-pressed={!!stage.blank}
                onClick={() => toggleOverlay(session, stage, "blank")}
              >
                <BlankIcon />
              </button>
              <button
                type="button"
                className="quiet icon-button"
                aria-label="Join screen"
                data-tip="Join screen (J)"
                aria-pressed={!!stage.join}
                onClick={() => toggleOverlay(session, stage, "join")}
              >
                <QrIcon />
              </button>
              <button
                type="button"
                className="quiet icon-button"
                aria-label="Class rules"
                data-tip="Class rules (R)"
                aria-pressed={!!stage.rules}
                onClick={() => toggleOverlay(session, stage, "rules")}
              >
                <RulesIcon />
              </button>
            </div>
            <div className="presence">
              <button
                type="button"
                className="quiet icon-button"
                aria-label="Student screens"
                data-tip="Student screens (G)"
                aria-pressed={drawer}
                onClick={() => setDrawer((o) => !o)}
              >
                <GridIcon />
              </button>
              <button
                type="button"
                className="quiet icon-button"
                aria-label="Name wheel"
                data-tip="Name wheel (W)"
                aria-pressed={!!stage.wheel?.open}
                onClick={() => toggleWheel(session, stage)}
              >
                <WheelIcon />
              </button>
              {data.applet.manifest.instructions !== undefined && (
                <button
                  type="button"
                  className="quiet icon-button"
                  aria-label="Chat"
                  data-tip="Chat"
                  aria-pressed={chatOpen}
                  onClick={() => setChatOpen((o) => !o)}
                >
                  <ChatIcon />
                </button>
              )}
              {data.teacherTimer && (
                <Countdown timer={data.teacherTimer} private />
              )}
            </div>
            <Modes session={session} data={data} keys />
            <Slideshow session={session} data={data} />
            <TimerControls session={session} data={data} />
            <End session={session} data={data} />
          </aside>
        )}
        {overlay && drawer && (
          <div className="thumbs-drawer">
            <Thumbnails
              session={session}
              data={data}
              html={html}
              touch={false}
            />
          </div>
        )}
      </TeacherStateContext.Provider>
      {overlay && (shownPulse || chatOpen) && (
        <div className="projection-sheet">
          {data.applet.manifest.instructions !== undefined && (
            <Chat
              session={session}
              uid={data.teacher}
              teacher
              shown={chatOpen && !shownPulse}
            />
          )}
          {shownPulse && <PulsePanel session={session} />}
        </div>
      )}
      {stage.wheel?.open && (
        <Wheel
          live={overlay}
          data={data}
          session={session}
          onPicked={(student) =>
            setWheelPick((p) => ({ student, n: (p?.n ?? 0) + 1 }))
          }
        />
      )}
      {stage.rules && <ClassRules onClose={uncover} />}
      {stage.join && <JoinScreen code={data.code} onClose={uncover} />}
      {stage.blank && (
        // biome-ignore lint/a11y/noStaticElementInteractions: any key also ends the blank
        // biome-ignore lint/a11y/useKeyWithClickEvents: any key also ends the blank
        <div className="blank" onClick={uncover} />
      )}
    </main>
  );
}

/** The spotlighted student's applet. The teacher can work on it, alongside the student. */
function SpotlitApplet({
  session,
  student,
  html,
  state,
}: {
  session: string;
  student: string;
  html: string;
  state: StoredState | undefined;
}) {
  const reset = state?.reset;
  const write = useThrottledWriter((s: StoredState) =>
    writeStudentState(session, student, {
      ...s,
      ...(reset ? { reset } : {}),
    }),
  );
  return <AppletFrame html={html} state={state ?? null} onUpdate={write} />;
}

/** Every student with their parsed state, as the teacher's applet sees them. */
function useClass(data: Session): Record<string, ClassMember> {
  const { students, states, presence } = data;
  return useMemo(() => {
    const out: Record<string, ClassMember> = {};
    for (const [uid, s] of Object.entries(students ?? {})) {
      const stored = states?.[uid];
      out[uid] = {
        name: s.name,
        phase: stored?.phase ?? 0,
        state: stored ? JSON.parse(stored.json) : null,
        online: !!presence?.[uid],
      };
    }
    return out;
  }, [students, states, presence]);
}

/** Mounts once per session so later teacherState echoes do not reset the applet. */
function TeacherApplet({
  data,
  html,
  pushed,
  onUpdate,
  ...rest
}: {
  data: Session;
  html: string;
  /** A state to load into the applet, replacing what the teacher has. */
  pushed: StoredState | null;
  onUpdate: (s: StoredState) => void;
} & Pick<
  React.ComponentProps<typeof AppletFrame>,
  | "onFilters"
  | "onControls"
  | "control"
  | "onTimer"
  | "onWheel"
  | "onSpotlight"
  | "wheelPick"
  | "slideshow"
  | "slide"
  | "onStep"
  | "onSlideshowToggle"
  | "onHotkey"
  | "onShortcut"
  | "onConnect"
>) {
  const [initial] = useState(data.teacherState ?? null);
  const students = useClass(data);
  return (
    <AppletFrame
      html={html}
      state={pushed ?? initial}
      onUpdate={onUpdate}
      owner="teacher"
      students={students}
      {...rest}
    />
  );
}

/** Where students go to join. */
const JOIN_URL = "mr-wong.netlify.app";

/** The address and the join code, filling the screen. Any click or key closes it. */
function JoinScreen({ code, onClose }: { code: string; onClose: () => void }) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: any key also closes it
    // biome-ignore lint/a11y/useKeyWithClickEvents: any key also closes it
    <div className="join-screen" onClick={onClose}>
      <div className="join-url">{JOIN_URL}</div>
      <div className="join-big">{code}</div>
    </div>
  );
}

/** The class rules R shows, as prompts the class completes. Each blank is about as long as the words it hides. */
const CLASS_RULES = [
  { lead: "Be", hidden: "ready to learn." },
  { lead: "Help", hidden: "your friends be ready to learn." },
  { lead: "Phones should be", hidden: "kept out of sight." },
];

/** The class rules, filling the screen. Any key or click hides them. */
function ClassRules({ onClose }: { onClose: () => void }) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: any key also closes it
    // biome-ignore lint/a11y/useKeyWithClickEvents: any key also closes it
    <div className="class-rules" onClick={onClose}>
      <ol>
        {CLASS_RULES.map((r) => (
          <li key={r.lead}>
            {r.lead}{" "}
            <span
              className="rule-blank"
              style={{ width: `${r.hidden.length}ch` }}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
