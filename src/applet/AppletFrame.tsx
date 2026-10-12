import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { StoredState } from "../firebase/types";
import { withBridge } from "./bridge";
import type {
  AppletContext,
  AppletMessage,
  ClassMember,
  HostMessage,
  WheelFilter,
} from "./contract";

/** The teacher's live state, handed to every student frame below it. */
export const TeacherStateContext = createContext<StoredState | null>(null);

function isFilter(v: unknown): v is WheelFilter {
  const f = v as WheelFilter;
  return (
    typeof f?.name === "string" &&
    f.name.trim() !== "" &&
    Array.isArray(f.students) &&
    f.students.every((s) => typeof s === "string")
  );
}

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
  /** Whose state this frame shows. The applet sees it as context.role. */
  owner?: AppletContext["role"];
  /** Every student, for the teacher's own frame. */
  students?: Record<string, ClassMember>;
  /** Called with the name wheel filters the applet publishes. */
  onFilters?: (filters: WheelFilter[]) => void;
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
  owner = "student",
  students,
  onFilters,
}: Props) {
  const teacherState = useContext(TeacherStateContext);
  const teacher = owner === "student" ? teacherState : null;
  const teacherJson = teacher?.json;
  const teacherPhase = teacher?.phase;
  const contextJson = useMemo(
    () =>
      JSON.stringify({
        role: owner,
        teacher:
          teacherJson !== undefined
            ? { state: JSON.parse(teacherJson), phase: teacherPhase ?? 0 }
            : null,
        students: students ?? null,
      } satisfies AppletContext),
    [owner, teacherJson, teacherPhase, students],
  );
  const frame = useRef<HTMLIFrameElement>(null);
  const known = useRef<Known | null>(null);
  const connected = useRef(false);
  const seq = useRef(0);
  const latest = useRef({
    state,
    onUpdate,
    maxPhase,
    onShortcut,
    onFilters,
    contextJson,
  });
  latest.current = {
    state,
    onUpdate,
    maxPhase,
    onShortcut,
    onFilters,
    contextJson,
  };
  const srcDoc = useMemo(() => withBridge(html), [html]);

  const post = (m: HostMessage) =>
    frame.current?.contentWindow?.postMessage(m, "*");
  const postContext = () =>
    post({ cc: "context", context: JSON.parse(latest.current.contextJson) });

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
      } else if (m?.cc === "filters") {
        if (Array.isArray(m.filters))
          latest.current.onFilters?.(m.filters.filter(isFilter));
      } else if (m?.cc === "connect") {
        connected.current = true;
        post({ cc: "phaseLimit", maxPhase });
        postContext();
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: post only when the context changes
  useEffect(() => {
    if (connected.current) postContext();
  }, [contextJson]);

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
