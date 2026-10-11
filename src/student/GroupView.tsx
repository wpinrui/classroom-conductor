import { type FormEvent, useState } from "react";
import { AppletFrame } from "../applet/AppletFrame";
import { writeGroupState } from "../firebase/client";
import type { StoredState } from "../firebase/types";
import { useGroup, useThrottledWriter } from "../hooks/session";
import { createGroup, joinGroup, leaveGroup } from "./groups";
import type { StageProps } from "./OwnApplet";

/** Group: members share one applet state. Without a group, the student makes or joins one. */
export function GroupView(props: StageProps) {
  const gid = props.me.group;
  const group = useGroup(props.session, gid);
  if (gid && group === undefined) return null;
  if (!gid || !group?.members?.[props.uid]) return <GroupPicker {...props} />;
  return (
    <GroupApplet {...props} gid={gid} code={group.code} state={group.state} />
  );
}

function GroupApplet({
  session,
  uid,
  html,
  gid,
  code,
  state,
}: StageProps & { gid: string; code: string; state?: StoredState }) {
  const write = useThrottledWriter((s: StoredState) =>
    writeGroupState(session, gid, s).catch(() => {}),
  );
  return (
    <>
      <AppletFrame html={html} state={state ?? null} onUpdate={write} />
      <div className="group-badge">
        <span className="group-code">{code}</span>
        <button
          type="button"
          className="quiet"
          onClick={() => leaveGroup(session, uid, gid).catch(() => {})}
        >
          Leave
        </button>
      </div>
    </>
  );
}

function GroupPicker({ session, uid }: StageProps) {
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setBad(false);
    try {
      await action();
    } catch {
      setBad(true);
      setBusy(false);
    }
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    run(() => joinGroup(session, uid, code));
  };

  return (
    <div className="center">
      <div className="join">
        <form className="join" onSubmit={join}>
          <input
            className="code-input"
            aria-label="Group code"
            placeholder="Code"
            aria-invalid={bad}
            maxLength={8}
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
          <button type="submit" className="primary" disabled={busy}>
            Join
          </button>
        </form>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => createGroup(session, uid))}
        >
          New group
        </button>
      </div>
    </div>
  );
}
