import { useEffect, useMemo, useRef, useState } from "react";
import { requestPulse } from "../firebase/client";
import type { Pulse } from "../firebase/types";
import { usePulses, useStudents } from "../hooks/session";
import { pulseDocument } from "./srcdoc";
import { showPulse, useShownPulse } from "./store";
import "./pulse.css";

const time = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Requests a Pulse, for the class or one student, and opens it. */
export function PulseButton({
  session,
  student,
  className,
}: {
  session: string;
  student?: string;
  className?: string;
}) {
  const pulses = usePulses(session);
  const [mine, setMine] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const status = mine ? pulses?.[mine]?.status : undefined;

  const request = async () => {
    setFailed(false);
    try {
      const pid = await requestPulse(session, student);
      setMine(pid);
      showPulse(pid);
    } catch {
      setFailed(true);
    }
  };

  return (
    <button
      type="button"
      className={`pulse-button ${className ?? ""}`}
      data-pending={status === "pending"}
      aria-invalid={failed || status === "error"}
      onClick={request}
    >
      Pulse
    </button>
  );
}

/** The teacher's Pulse sheet: every Pulse this session, newest first, with the open one rendered. */
export function PulsePanel({ session }: { session: string }) {
  const pulses = usePulses(session);
  const students = useStudents(session);
  const shown = useShownPulse();
  const newest =
    pulses === undefined
      ? undefined
      : Object.keys(pulses ?? {}).reduce((a, b) => (a > b ? a : b), "");
  const seenNewest = useRef<string | undefined>(undefined);

  // A Pulse requested from anywhere opens as soon as it appears. Push keys sort by time.
  useEffect(() => {
    if (newest === undefined) return;
    const first = seenNewest.current === undefined;
    if (!first && newest && newest !== seenNewest.current) showPulse(newest);
    seenNewest.current = newest;
  }, [newest]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") showPulse(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown]);

  const list = Object.entries(pulses ?? {}).sort(([, a], [, b]) => b.at - a.at);
  const open = shown ? pulses?.[shown] : undefined;
  if (!shown || !open) return null;
  const nameOf = (p: Pulse) => (p.student ? students?.[p.student]?.name : null);
  const name = nameOf(open);

  return (
    <aside className="pulse-sheet">
      <button
        type="button"
        className="quiet pulse-close"
        aria-label="Close"
        onClick={() => showPulse(null)}
      >
        ✕
      </button>
      {list.length > 1 && (
        <nav className="pulse-list">
          {list.map(([pid, p]) => (
            <button
              key={pid}
              type="button"
              className="pulse-chip"
              aria-pressed={pid === shown}
              aria-invalid={p.status === "error"}
              data-pending={p.status === "pending"}
              onClick={() => showPulse(pid)}
            >
              {p.student ? (
                <span className="pulse-chip-name">{nameOf(p) ?? "?"}</span>
              ) : (
                <ClassIcon />
              )}
              <span className="caption">{time(p.at)}</span>
            </button>
          ))}
        </nav>
      )}
      {name && list.length === 1 && <h2 className="pulse-name">{name}</h2>}
      <div
        className="pulse-body"
        data-pending={open.status === "pending"}
        aria-invalid={open.status === "error"}
      >
        {open.output && <PulseFrame output={open.output} />}
      </div>
    </aside>
  );
}

/** A Pulse's freeform HTML, sandboxed: scripts run, but nothing reaches the app. */
function PulseFrame({ output }: { output: string }) {
  const srcDoc = useMemo(
    () => pulseDocument(output, document.documentElement),
    [output],
  );
  return (
    <iframe
      className="pulse-frame"
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      title="Pulse"
    />
  );
}

function ClassIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-label="Class">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5M15 14.5c3 0 6 1.4 6 4.5" />
      </g>
    </svg>
  );
}
