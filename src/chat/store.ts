import { useSyncExternalStore } from "react";

// Whether the page's one chat drawer is open, and whether it holds an unread
// reply. Shared so a toggle elsewhere, like the controls panel, can drive it.
let state = { open: false, unread: false };
const listeners = new Set<() => void>();

export function setChat(patch: Partial<typeof state>) {
  const next = { ...state, ...patch };
  if (next.open === state.open && next.unread === state.unread) return;
  state = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const useChatState = () => useSyncExternalStore(subscribe, () => state);
