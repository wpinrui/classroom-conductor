/** Chat messages per student per minute when the teacher has not set a limit. */
export const DEFAULT_CHAT_LIMIT = 5;
export const CHAT_WINDOW_MS = 60_000;

export interface Cooldown {
  start: number;
  until: number;
}

/** The cooldown in force at `now`, or null when the student may send. A limit of 0 is unlimited. */
export function chatCooldown(
  sent: number[],
  limit: number | undefined,
  now: number,
): Cooldown | null {
  const max = limit ?? DEFAULT_CHAT_LIMIT;
  if (max <= 0) return null;
  const recent = sent
    .filter((t) => t > now - CHAT_WINDOW_MS)
    .sort((a, b) => a - b);
  if (recent.length < max) return null;
  return {
    start: recent[recent.length - 1],
    until: recent[recent.length - max] + CHAT_WINDOW_MS,
  };
}
