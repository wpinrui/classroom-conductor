import { useEffect, useRef, useState } from "react";
import { AppletFrame } from "../applet/AppletFrame";
import { requestPulse, setControl } from "../firebase/client";
import type { Session, StoredState } from "../firebase/types";
import { showPulse } from "../pulse/store";
import { CheckIcon, PulseIcon, SpotlightIcon } from "./icons";

/** Applets render at this size, then scale down to fit the tile. */
const FRAME_WIDTH = 1280;
const MIN_DRAWER_PX = 120;

/** Bottom drawer of live, view-only student screens. It is also the Spotlight and Gallery picker. */
export function Thumbnails({
  session,
  data,
}: {
  session: string;
  data: Session;
}) {
  const { mode, spotlight, gallery = {} } = data.control;
  const spotlighting = mode === "spotlight" || mode === "anonymousSpotlight";
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
  const students = Object.entries(data.students ?? {}).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name),
  );
  const [height, setHeight] = useState<number | null>(null);

  const click = (uid: string) => {
    if (spotlighting) setControl(session, { spotlight: uid });
    else if (mode === "gallery") {
      const next = { ...gallery };
      if (next[uid]) delete next[uid];
      else next[uid] = true;
      setControl(session, { gallery: next });
    } else {
      const pid = latestPulse.get(uid);
      if (pid) showPulse(pid);
    }
  };

  const resize = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) =>
      setHeight(Math.max(MIN_DRAWER_PX, window.innerHeight - m.clientY));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <section
      className="thumbs-drawer"
      style={height ? { height } : undefined}
      aria-label="Student screens"
    >
      <div
        className="drawer-handle"
        aria-hidden="true"
        onPointerDown={resize}
      />
      <ul className="thumbs">
        {students.map(([uid, s]) => (
          <li
            key={uid}
            className="thumb"
            data-offline={!data.presence?.[uid] || undefined}
            data-selected={
              (spotlighting
                ? spotlight === uid
                : mode === "gallery" && !!gallery[uid]) || undefined
            }
          >
            <button
              type="button"
              className="thumb-view"
              aria-label={s.name}
              onClick={() => click(uid)}
            >
              <Thumb
                html={data.applet.html}
                state={data.states?.[uid] ?? null}
              />
            </button>
            <span className="thumb-name">{s.name}</span>
            {latestPulse.has(uid) && <span className="dot accent thumb-dot" />}
            {mode === "gallery" && gallery[uid] && (
              <span className="thumb-badge">
                <CheckIcon />
              </span>
            )}
            <div className="thumb-actions">
              <button
                type="button"
                aria-label="Spotlight"
                data-tip="Spotlight"
                onClick={() =>
                  setControl(session, {
                    spotlight: uid,
                    ...(spotlighting ? {} : { mode: "spotlight" }),
                  })
                }
              >
                <SpotlightIcon />
              </button>
              {data.applet.manifest.pulsePrompt !== undefined && (
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
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One scaled, non-interactive applet that tracks its tile's width. */
function Thumb({ html, state }: { html: string; state: StoredState | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setScale(e.contentRect.width / FRAME_WIDTH),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={box}
      className="thumb-box"
      style={{ "--thumb-scale": scale } as React.CSSProperties}
    >
      <AppletFrame
        html={html}
        state={state}
        interactive={false}
        className="thumb-frame"
      />
    </div>
  );
}
