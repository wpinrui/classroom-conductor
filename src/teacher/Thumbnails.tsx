import { useEffect, useRef, useState } from "react";
import { AppletFrame } from "../applet/AppletFrame";
import type { AppletContext } from "../applet/contract";
import { requestPulse, setControl } from "../firebase/client";
import type { Session, StoredState } from "../firebase/types";
import { PulseButton } from "../pulse/Pulse";
import { showPulse } from "../pulse/store";
import { spotlightStudent } from "../stage/actions";
import { CheckIcon, PulseIcon, SearchIcon, SpotlightIcon } from "./icons";
import { isTextTarget } from "./slides";

/** Applets render at this size, then scale down to fit the tile. */
const FRAME_WIDTH = 1280;
/** Keys that stay hotkeys on the laptop, so typing them never starts a search. */
const HOTKEYS = "bgjrsw";

/** A press held this long opens the student's Pulse on touch. */
const LONG_PRESS_MS = 500;

/** The applet sets $done in a student's state once they reach what their phase asks for. */
function isDone(json: string | undefined): boolean {
  if (!json) return false;
  try {
    return JSON.parse(json)?.$done === true;
  } catch {
    return false;
  }
}

/** Live, view-only student screens on the remote. Also the Spotlight and Gallery picker. */
export function Thumbnails({
  session,
  data,
  html,
  touch,
}: {
  session: string;
  data: Session;
  html: string;
  touch: boolean;
}) {
  const { mode, spotlight, gallery = {} } = data.control;
  const spotlighting = mode === "spotlight" || mode === "anonymousSpotlight";
  const hasPulse = data.applet.manifest.pulsePrompt !== undefined;
  const pulses = Object.values(data.pulses ?? {});
  const pending = new Set(
    pulses.filter((p) => p.status === "pending").map((p) => p.student),
  );
  /** Each student's newest finished Pulse. Push ids sort by time. */
  const latestPulse = new Map<string, string>();
  for (const [pid, p] of Object.entries(data.pulses ?? {}).sort(([a], [b]) =>
    a < b ? -1 : 1,
  ))
    if (p.student && p.status === "done") latestPulse.set(p.student, pid);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const students = Object.entries(data.students ?? {})
    .filter(([, s]) => !q || s.name.toLowerCase().includes(q))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));
  const search = useRef<HTMLInputElement>(null);

  // On the laptop, typing a letter that is not a hotkey starts a search.
  useEffect(() => {
    if (touch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextTarget(e.target)) return;
      if (!/^[a-z]$/i.test(e.key) || HOTKEYS.includes(e.key.toLowerCase()))
        return;
      e.preventDefault();
      search.current?.focus();
      setQuery((v) => v + e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [touch]);

  const click = (uid: string) => {
    if (spotlighting) {
      setControl(session, { spotlight: uid });
    } else if (mode === "gallery") {
      const next = { ...gallery };
      if (next[uid]) delete next[uid];
      else next[uid] = true;
      setControl(session, { gallery: next });
    } else {
      const pid = latestPulse.get(uid);
      if (pid) showPulse(pid);
    }
  };
  /** Opens the student's newest Pulse, or asks for one. */
  const pulse = (uid: string) => {
    const pid = latestPulse.get(uid);
    if (pid) showPulse(pid);
    else if (hasPulse && !pending.has(uid))
      requestPulse(session, uid).then(showPulse);
  };

  return (
    <section className="screens" aria-label="Student screens">
      <div className="screens-bar">
        <label className="screens-search">
          <SearchIcon />
          <input
            ref={search}
            type="search"
            aria-label="Search students"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds the first match to the gallery in Gallery, and spotlights it otherwise.
              const first = students[0]?.[0];
              if (e.key === "Enter" && first)
                mode === "gallery"
                  ? click(first)
                  : spotlightStudent(session, data, first);
              if (e.key === "Escape") {
                e.stopPropagation();
                setQuery("");
                e.currentTarget.blur();
              }
            }}
          />
        </label>
        {hasPulse && <PulseButton session={session} />}
      </div>
      <ul className="thumbs">
        {students.map(([uid, s]) => (
          <li
            key={uid}
            className="thumb"
            data-offline={!data.presence?.[uid] || undefined}
            data-done={isDone(data.states?.[uid]?.json) || undefined}
            data-selected={
              (spotlighting
                ? spotlight === uid
                : mode === "gallery" && !!gallery[uid]) || undefined
            }
          >
            <TileButton
              label={s.name}
              onClick={() => click(uid)}
              onLongPress={touch ? () => pulse(uid) : undefined}
            >
              <Thumb html={html} state={data.states?.[uid] ?? null} />
            </TileButton>
            <span className="thumb-name">{s.name}</span>
            {latestPulse.has(uid) && <span className="dot accent thumb-dot" />}
            {mode === "gallery" && gallery[uid] && (
              <span className="thumb-badge">
                <CheckIcon />
              </span>
            )}
            {!touch && (
              <div className="thumb-actions">
                <button
                  type="button"
                  aria-label="Spotlight"
                  data-tip="Spotlight"
                  onClick={() => spotlightStudent(session, data, uid)}
                >
                  <SpotlightIcon />
                </button>
                {hasPulse && (
                  <button
                    type="button"
                    aria-label="Pulse"
                    data-tip="Pulse"
                    aria-busy={pending.has(uid)}
                    disabled={pending.has(uid)}
                    onClick={() => requestPulse(session, uid).then(showPulse)}
                  >
                    <PulseIcon />
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A tile's button. On touch, a long press runs onLongPress instead of the click. */
function TileButton({
  label,
  onClick,
  onLongPress,
  children,
}: {
  label: string;
  onClick: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      type="button"
      className="thumb-view"
      aria-label={label}
      onPointerDown={() => {
        fired.current = false;
        if (!onLongPress) return;
        timer.current = setTimeout(() => {
          fired.current = true;
          onLongPress();
        }, LONG_PRESS_MS);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => onLongPress && e.preventDefault()}
      onClick={() => {
        if (!fired.current) onClick();
      }}
    >
      {children}
    </button>
  );
}

/** One scaled, non-interactive applet that tracks its tile's width. It renders only while on screen. */
export function Thumb({
  html,
  state,
  owner,
}: {
  html: string;
  state: StoredState | null;
  owner?: AppletContext["role"];
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setScale(e.contentRect.width / FRAME_WIDTH),
    );
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    ro.observe(el);
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);
  return (
    <div
      ref={box}
      className="thumb-box"
      style={{ "--thumb-scale": scale } as React.CSSProperties}
    >
      {visible && (
        <AppletFrame
          html={html}
          state={state}
          interactive={false}
          owner={owner}
          className="thumb-frame"
        />
      )}
    </div>
  );
}
