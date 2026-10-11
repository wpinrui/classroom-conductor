import { useEffect, useMemo, useRef } from "react";
import type { StoredState } from "../firebase/types";
import { withBridge } from "./bridge";
import type { AppletMessage, HostMessage } from "./contract";

interface Props {
  html: string;
  /** State to show. A change is pushed into the applet. */
  state?: StoredState | null;
  /** Called with every state change the applet makes. */
  onUpdate?: (state: StoredState) => void;
  /** Highest phase the applet may move to. */
  maxPhase?: number | null;
  /** False makes the applet view-only. */
  interactive?: boolean;
  className?: string;
  /** Called when the controls shortcut is pressed inside the applet. */
  onShortcut?: () => void;
}

type Known = { json: string; phase: number };

/** Runs an applet in a sandboxed frame and keeps its state in sync. */
export function AppletFrame({
  html,
  state,
  onUpdate,
  maxPhase = null,
  interactive = true,
  className,
  onShortcut,
}: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const known = useRef<Known | null>(null);
  const connected = useRef(false);
  const seq = useRef(0);
  const latest = useRef({ state, onUpdate, maxPhase, onShortcut });
  latest.current = { state, onUpdate, maxPhase, onShortcut };
  const srcDoc = useMemo(() => withBridge(html), [html]);

  const post = (m: HostMessage) =>
    frame.current?.contentWindow?.postMessage(m, "*");

  const push = (s: Known) => {
    known.current = s;
    seq.current += 1;
    post({
      cc: "setState",
      state: JSON.parse(s.json),
      phase: s.phase,
      seq: seq.current,
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run per page load only
  useEffect(() => {
    connected.current = false;
    known.current = null;
    seq.current = 0;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data as AppletMessage;
      const { state, onUpdate, maxPhase } = latest.current;
      if (m?.cc === "shortcut") {
        latest.current.onShortcut?.();
      } else if (m?.cc === "connect") {
        connected.current = true;
        post({ cc: "phaseLimit", maxPhase });
        if (state) push(state);
      } else if (m?.cc === "update") {
        if (m.seq !== seq.current) return;
        const next = { json: JSON.stringify(m.state), phase: m.phase };
        if (maxPhase !== null && next.phase > maxPhase) {
          if (known.current) push(known.current);
          return;
        }
        const k = known.current;
        if (k && k.json === next.json && k.phase === next.phase) return;
        known.current = next;
        onUpdate?.({ ...next, at: Date.now() });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [srcDoc]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: push only when the state itself changes
  useEffect(() => {
    if (!connected.current || !state) return;
    const k = known.current;
    if (k && k.json === state.json && k.phase === state.phase) return;
    push(state);
  }, [state?.json, state?.phase]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: post only when the limit changes
  useEffect(() => {
    if (connected.current) post({ cc: "phaseLimit", maxPhase });
  }, [maxPhase]);

  return (
    <iframe
      ref={frame}
      className={className ?? "applet-frame"}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-forms allow-modals"
      inert={!interactive}
      title="Applet"
    />
  );
}
