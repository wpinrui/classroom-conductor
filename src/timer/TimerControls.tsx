import { useState } from "react";
import type { Session, Timer } from "../firebase/types";
import { ClockIcon, EyeIcon, EyeOffIcon, PauseIcon, PlayIcon } from "./icons";
import {
  addMinute,
  parseDuration,
  pause,
  remaining,
  resume,
  setTimer,
  start,
  useServerNow,
} from "./timer";
import "./timer.css";

const PRESETS = [1, 3, 5, 10];

/** Timer group on the controls panel: presets and a custom value, then pause, add and cancel. */
export function TimerControls({
  session,
  data,
}: {
  session: string;
  data: Session;
}) {
  const timer = data.control.timer ?? data.teacherTimer ?? null;
  const [sharedChoice, setSharedChoice] = useState(true);
  const shared = timer ? Boolean(data.control.timer) : sharedChoice;
  const [custom, setCustom] = useState("");
  const [invalid, setInvalid] = useState(false);
  const now = useServerNow(timer?.endsAt !== undefined);
  const write = (t: Timer | null, s = shared) => setTimer(session, t, s);

  const begin = (ms: number) => {
    setCustom("");
    write(start(ms, now));
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ms = parseDuration(custom);
    setInvalid(ms === null);
    if (ms !== null) begin(ms);
  };
  const toggleShared = () => {
    if (timer) write(timer, !shared);
    else setSharedChoice(!shared);
  };

  const visibility = (
    <button
      type="button"
      className="quiet icon-button"
      aria-label="Students see the timer"
      data-tip="Students see the timer"
      aria-pressed={shared}
      onClick={toggleShared}
    >
      {shared ? <EyeIcon /> : <EyeOffIcon />}
    </button>
  );
  const label = (
    <span
      className="stepper-label"
      role="img"
      aria-label="Timer"
      data-tip="Timer"
    >
      <ClockIcon />
    </span>
  );

  if (timer) {
    const paused = timer.left !== undefined;
    const done = remaining(timer, now) === 0;
    return (
      <div className="row timer-row">
        {label}
        <button
          type="button"
          className="icon-button"
          aria-label={paused ? "Resume" : "Pause"}
          disabled={done}
          onClick={() => write(paused ? resume(timer, now) : pause(timer, now))}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button type="button" onClick={() => write(addMinute(timer, now))}>
          +1m
        </button>
        {visibility}
        <button
          type="button"
          className="quiet icon-button timer-cancel"
          aria-label="Cancel timer"
          onClick={() => write(null)}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="timer-controls">
      <form className="row" onSubmit={submit}>
        {label}
        <input
          inputMode="decimal"
          aria-label="Minutes"
          placeholder="min"
          aria-invalid={invalid || undefined}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setInvalid(false);
          }}
        />
        {visibility}
      </form>
      <div className="timer-presets">
        {PRESETS.map((m) => (
          <button key={m} type="button" onClick={() => begin(m * 60_000)}>
            {m}m
          </button>
        ))}
      </div>
    </div>
  );
}
