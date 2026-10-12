import type { Timer } from "../firebase/types";
import { ClockIcon } from "./icons";
import { clock, minutes, remaining, useServerNow } from "./timer";
import "./timer.css";

/**
 * The countdown pill at the top of the stage. Shared timers show m:ss.
 * The teacher's private timer is quieter and shows whole minutes only.
 */
export function Countdown({
  timer,
  private: isPrivate = false,
}: {
  timer: Timer;
  private?: boolean;
}) {
  const now = useServerNow(timer.endsAt !== undefined);
  const ms = remaining(timer, now);
  return (
    <output
      className="countdown"
      data-private={isPrivate || undefined}
      data-paused={timer.left !== undefined || undefined}
      data-done={ms === 0 || undefined}
      aria-label="Time left"
    >
      {isPrivate ? (
        <>
          <ClockIcon />
          {minutes(ms)}m
        </>
      ) : (
        clock(ms)
      )}
    </output>
  );
}
