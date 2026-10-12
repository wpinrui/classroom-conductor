import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { AppletFrame, TeacherStateContext } from "../applet/AppletFrame";
import {
  type ClassMember,
  preparedJson,
  type SlideCue,
  type WheelFilter,
  type WheelOptions,
} from "../applet/contract";
import { Chat } from "../chat/Chat";
import { setControl, setWheel, writeTeacherState } from "../firebase/client";
import type { Session, StoredState } from "../firebase/types";
import { useSession, useThrottledWriter } from "../hooks/session";
import { PulsePanel } from "../pulse/Pulse";
import { Countdown } from "../timer/Countdown";
import { scriptTimer } from "../timer/timer";
import { Controls } from "./Controls";
import { allowedModes, defaultsFor, teacherPhase } from "./modes";
import {
  isTextTarget,
  loadCursor,
  NEXT_KEYS,
  PREV_KEYS,
  type SlideEffect,
  saveCursor,
  slideCues,
  slideEffect,
  wheelGesture,
} from "./slides";
import { Thumbnails } from "./Thumbnails";
import { Wheel, type WheelCommand } from "./Wheel";

/** How long a slideshow step waits for the applet to reach its phase before setting the mode anyway. */
const SLIDE_MODE_WAIT_MS = 3000;

type SlideMessage = { phase: number; cues: SlideCue[]; n: number };

/** The teacher's live view: their own applet with the controls overlaid. */
export function TeacherSession() {
  const { session = "" } = useParams();
  const data = useSession(session);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [wheelOpen, setWheelOpen] = useState(false);
  // The student screens drawer. Lives here so G works with the controls hidden.
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [filters, setFilters] = useState<WheelFilter[]>([]);
  const [wheelCommand, setWheelCommand] = useState<WheelCommand | null>(null);
  const commands = useRef(0);
  const [wheelPick, setWheelPick] = useState<{
    student: string;
    n: number;
  } | null>(null);
  const [blank, setBlank] = useState(false);
  const blankOn = () => {
    // Pull focus out of the applet, so the next key reaches the page and ends the blank.
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    setBlank(true);
  };

  /** Spotlights a student, keeping Anonymous Spotlight anonymous. Null ends the spotlight. */
  const spotlight = (uid: string | null) => {
    if (uid === null) return setControl(session, { spotlight: null });
    if (!data?.students?.[uid]) return;
    const m = data.control.mode;
    setControl(session, {
      spotlight: uid,
      ...(m === "spotlight" || m === "anonymousSpotlight"
        ? {}
        : { mode: "spotlight" }),
    });
  };

  /** The applet drives the name wheel. The teacher can still close or change it from the controls. */
  const onWheel = (raw: unknown) => {
    if (typeof raw !== "object" || raw === null) return;
    const o = raw as WheelOptions;
    // Once the teacher has chosen, the applet's choice no longer applies.
    if (typeof o.replacement === "boolean" && !data?.control.wheel?.teacherSet)
      setWheel(session, { replacement: o.replacement });
    if (o.open === false && !o.spin) return setWheelOpen(false);
    const filter = typeof o.filter === "string" ? o.filter : undefined;
    if (o.open || o.spin) setWheelOpen(true);
    if (filter !== undefined || o.spin)
      setWheelCommand({ filter, spin: !!o.spin, n: ++commands.current });
  };
  // Slideshow: the teacher steps through manifest.slides. Going back re-applies a step, it never undoes one.
  const slides = data?.applet.manifest.slides ?? [];
  const [slideshowOn, setSlideshowOn] = useState(false);
  const [cursor, setCursorState] = useState(() => loadCursor(session));
  const cursorRef = useRef(cursor);
  const [slide, setSlide] = useState<SlideMessage | null>(null);
  const latestData = useRef(data);
  latestData.current = data;
  const pendingMode = useRef<{
    phase: number;
    effect: SlideEffect;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const setCursor = (k: number) => {
    cursorRef.current = k;
    setCursorState(k);
    saveCursor(session, k);
  };

  /** Sets the mode a step leaves in force, with the same defaults the mode buttons use. */
  const applySlideMode = (effect: SlideEffect, d: Session) => {
    if (effect.reveal !== undefined) {
      const p = d.applet.manifest.preparedStates?.find(
        (x) => x.name === effect.reveal,
      );
      if (p)
        setControl(session, {
          mode: "reveal",
          reveal: { json: preparedJson(p), phase: p.phase, at: Date.now() },
        });
      return;
    }
    if (effect.mode)
      setControl(session, {
        mode: effect.mode,
        ...defaultsFor(effect.mode, d),
      });
  };
  const clearPendingMode = () => {
    if (pendingMode.current) clearTimeout(pendingMode.current.timer);
    pendingMode.current = null;
  };

  const stepSlide = (dir: 1 | -1) => {
    if (!data || slides.length === 0) return;
    const k = Math.min(cursorRef.current, slides.length - 1) + dir;
    if (k < 0 || k >= slides.length) return;
    setCursor(k);
    // The wheel belongs to the step that spun it. Any other step puts it away.
    if (!slides[k].wheel) setWheelOpen(false);
    const forward = dir === 1;
    const effect = slideEffect(slides, k);
    const target = effect.phase ?? teacherPhase(data);
    const cues = slideCues(slides, k, forward);
    setSlide((m) => ({ phase: target, cues, n: (m?.n ?? 0) + 1 }));
    clearPendingMode();
    // Setting a mode before the applet reaches the step's phase would let that phase's allowed modes undo it.
    if (target === teacherPhase(data)) applySlideMode(effect, data);
    else
      pendingMode.current = {
        phase: target,
        effect,
        timer: setTimeout(() => {
          const p = pendingMode.current;
          pendingMode.current = null;
          if (p && latestData.current)
            applySlideMode(p.effect, latestData.current);
        }, SLIDE_MODE_WAIT_MS),
      };
    if (!forward) return;
    const s = slides[k];
    if (s.wheel) onWheel(s.wheel);
    if (s.timer !== undefined)
      scriptTimer(session, s.timer, s.timerShared ?? true);
  };
  const toggleSlideshow = () => {
    if (slides.length > 0) setSlideshowOn((o) => !o);
  };
  const show = useRef({
    on: slideshowOn,
    step: stepSlide,
    toggle: toggleSlideshow,
  });
  show.current = { on: slideshowOn, step: stepSlide, toggle: toggleSlideshow };

  // S toggles the slideshow. While it is on, the wheel and the step keys move through it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextTarget(e.target)) return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        show.current.toggle();
        return;
      }
      if (!show.current.on) return;
      const dir = NEXT_KEYS.includes(e.key)
        ? 1
        : PREV_KEYS.includes(e.key)
          ? -1
          : 0;
      if (dir === 0) return;
      e.preventDefault();
      show.current.step(dir);
    };
    const gesture = wheelGesture();
    const onWheelEvent = (e: WheelEvent) => {
      if (!show.current.on) return;
      e.preventDefault();
      const dir = gesture(e);
      if (dir !== 0) show.current.step(dir);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheelEvent, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheelEvent);
    };
  }, []);

  const write = useThrottledWriter((s: StoredState) =>
    writeTeacherState(session, s),
  );

  // While blank, any key or click brings the screen back.
  useEffect(() => {
    if (!blank) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      setBlank(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [blank]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: blankOn only calls state setters
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const typing =
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !typing &&
        (e.key === "g" || e.key === "G")
      ) {
        e.preventDefault();
        setThumbsOpen((o) => !o);
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !typing && e.key === "b") {
        e.preventDefault();
        blankOn();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        e.preventDefault();
        setControlsOpen((o) => !o);
      }
    };
    // The middle mouse button toggles the controls too. Clicks inside the applet arrive through the bridge.
    const onMiddle = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      setControlsOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMiddle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMiddle);
    };
  }, []);

  // Clicking the lesson itself tucks the controls away. Ctrl+. or the middle button brings them back.
  useEffect(() => {
    if (!controlsOpen) return;
    const inFrame = () => document.activeElement instanceof HTMLIFrameElement;
    // Reopened from inside the applet: release its focus so the next click in it registers.
    if (inFrame()) (document.activeElement as HTMLElement).blur();
    const onBlur = () =>
      setTimeout(() => {
        if (inFrame()) setControlsOpen(false);
      });
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (
        t instanceof Element &&
        (t.matches("main.stage, iframe") || t.closest(".teacher-spotlight"))
      )
        setControlsOpen(false);
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [controlsOpen]);

  // When the applet narrows the modes per phase, leave a mode the current phase does not allow.
  const allowed = data ? allowedModes(data) : null;
  const mode = data?.control.mode;
  const phase = data ? teacherPhase(data) : 0;
  const requested = useRef("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: allowed and data are derived from mode and phase
  useEffect(() => {
    if (!data || !allowed || !mode) return;
    if (allowed.includes(mode)) {
      requested.current = "";
      return;
    }
    const next = allowed[0];
    const key = `${phase}:${mode}:${next}`;
    if (requested.current === key) return;
    requested.current = key;
    setControl(session, { mode: next, ...defaultsFor(next, data) });
  }, [session, mode, phase, allowed?.join()]);

  // A slideshow step's mode lands once the applet reaches the step's phase, after the switch above.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the teacher's phase changes
  useEffect(() => {
    const p = pendingMode.current;
    if (!p || p.phase !== phase || !latestData.current) return;
    clearPendingMode();
    applySlideMode(p.effect, latestData.current);
  }, [phase]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: clears the wait on unmount only
  useEffect(() => clearPendingMode, []);

  if (!data) return null;
  const { manifest } = data.applet;
  const target =
    data.control.mode === "spotlight" ||
    data.control.mode === "anonymousSpotlight"
      ? data.control.spotlight
      : undefined;
  return (
    <main className="stage" data-bare={!controlsOpen || undefined}>
      <TeacherStateContext.Provider value={data.teacherState ?? null}>
        <TeacherApplet
          data={data}
          onUpdate={write}
          onShortcut={() => setControlsOpen((o) => !o)}
          onFilters={setFilters}
          onTimer={(seconds, shared) => scriptTimer(session, seconds, shared)}
          onWheel={onWheel}
          onSpotlight={(raw) => spotlight(typeof raw === "string" ? raw : null)}
          wheelPick={wheelPick}
          slideshow={slides.length > 0 ? slideshowOn : undefined}
          slide={slide}
          onStep={(dir) => show.current.step(dir)}
          onSlideshowToggle={() => show.current.toggle()}
          onHotkey={(k) => k === "g" && setThumbsOpen((o) => !o)}
        />
        {target && data.students?.[target] && (
          <div className="teacher-spotlight">
            <AppletFrame
              key={target}
              html={data.applet.html}
              state={data.states?.[target] ?? null}
              interactive={false}
            />
          </div>
        )}
        <div className="status-bar">
          {/* The projector shows this screen, so it says only what students would see. */}
          {target && data.students?.[target] && (
            <output className="status" data-tone="watch">
              {data.control.mode === "spotlight" ? (
                <span>
                  Viewing <b>{data.students[target].name}'s</b> screen
                </span>
              ) : (
                <span>
                  Viewing a <b>classmate's</b> screen
                </span>
              )}
            </output>
          )}
          {data.control.timer && <Countdown timer={data.control.timer} />}
          {data.teacherTimer && <Countdown timer={data.teacherTimer} private />}
        </div>
        {controlsOpen && (
          <Controls
            session={session}
            data={data}
            wheelOpen={wheelOpen}
            onWheel={() => setWheelOpen((o) => !o)}
            onBlank={blankOn}
            thumbsOpen={thumbsOpen}
            onThumbs={() => setThumbsOpen((o) => !o)}
            slideshow={
              slides.length > 0
                ? {
                    on: slideshowOn,
                    at: Math.min(cursor, slides.length - 1),
                    count: slides.length,
                    next: slides[Math.min(cursor, slides.length - 1) + 1]
                      ?.label,
                    onToggle: toggleSlideshow,
                  }
                : undefined
            }
          />
        )}
        {/* Inside the provider: student screens draw from the teacher's state. */}
        {thumbsOpen && <Thumbnails session={session} data={data} />}
      </TeacherStateContext.Provider>
      {wheelOpen && (
        <Wheel
          data={data}
          session={session}
          filters={filters}
          command={wheelCommand}
          onCommandDone={() => setWheelCommand(null)}
          onClose={() => setWheelOpen(false)}
          onPicked={(student) =>
            setWheelPick((p) => ({ student, n: (p?.n ?? 0) + 1 }))
          }
          onSpotlight={(uid) => {
            spotlight(uid);
            setWheelOpen(false);
          }}
        />
      )}
      {manifest.pulsePrompt !== undefined && <PulsePanel session={session} />}
      {manifest.instructions !== undefined && (
        <Chat session={session} uid={data.teacher} teacher />
      )}
      {blank && (
        // biome-ignore lint/a11y/noStaticElementInteractions: any key also ends the blank
        // biome-ignore lint/a11y/useKeyWithClickEvents: any key also ends the blank
        <div className="blank" onClick={() => setBlank(false)} />
      )}
    </main>
  );
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
  onUpdate,
  onShortcut,
  onFilters,
  onTimer,
  onWheel,
  onSpotlight,
  wheelPick,
  slideshow,
  slide,
  onStep,
  onSlideshowToggle,
  onHotkey,
}: {
  data: Session;
  onUpdate: (s: StoredState) => void;
  onShortcut: () => void;
  onFilters: (f: WheelFilter[]) => void;
  onTimer: (seconds: unknown, shared: unknown) => void;
  onWheel: (options: unknown) => void;
  onSpotlight: (student: unknown) => void;
  wheelPick: { student: string; n: number } | null;
  slideshow: boolean | undefined;
  slide: SlideMessage | null;
  onStep: (dir: 1 | -1) => void;
  onSlideshowToggle: () => void;
  onHotkey: (key: string) => void;
}) {
  const [initial] = useState(data.teacherState ?? null);
  const students = useClass(data);
  return (
    <AppletFrame
      html={data.applet.html}
      state={initial}
      onUpdate={onUpdate}
      onShortcut={onShortcut}
      owner="teacher"
      students={students}
      onFilters={onFilters}
      onTimer={onTimer}
      onWheel={onWheel}
      onSpotlight={onSpotlight}
      wheelPick={wheelPick}
      slideshow={slideshow}
      slide={slide}
      onStep={onStep}
      onSlideshowToggle={onSlideshowToggle}
      onHotkey={onHotkey}
    />
  );
}
