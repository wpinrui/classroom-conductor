import { useSyncExternalStore } from "react";

// Which Pulse the teacher's sheet shows. Anything can open one: the Pulse
// button, a thumbnail tile or the controls panel.
let shown: string | null = null;
const listeners = new Set<() => void>();

export function showPulse(pulse: string | null) {
  shown = pulse;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const useShownPulse = () => useSyncExternalStore(subscribe, () => shown);
