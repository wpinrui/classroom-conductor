import { type FormEvent, useEffect, useState } from "react";
import { AppletFrame } from "../applet/AppletFrame";
import { writeGroupState } from "../firebase/client";
import { paths } from "../firebase/paths";
import type { StoredState, Student } from "../firebase/types";
import { useGroup, useThrottledWriter } from "../hooks/session";
import { useValue } from "../hooks/useValue";
import { Loading } from "./Cues";
import { createGroup, joinGroup } from "./groups";
import type { StageProps } from "./OwnApplet";

// One create in flight per student, so a remount cannot make a second group.
const creating = new Map<string, Promise<unknown>>();

/**
 * Group: members share one applet state. A student always holds a group. Until
 * someone else joins it, they see its code and can join another group instead.
 */
export function GroupView(props: StageProps) {
  const { session, uid } = props;
  const gid = props.me.group;
  const group = useGroup(session, gid);
  const missing = !gid || group === null || (group && !group.members?.[uid]);

  useEffect(() => {
    const key = `${session}/${uid}`;
    if (!missing || creating.has(key)) return;
    creating.set(
      key,
      createGroup(session, uid)
        .catch(() => {})
        .finally(() => creating.delete(key)),
    );
  }, [missing, session, uid]);

  if (missing || !gid || !group) return <Loading />;
  const members = Object.keys(group.members);
  if (members.length < 2)
    return (
      <GroupCard session={session} uid={uid} gid={gid} code={group.code} />
    );
  return (
    <>
      <GroupApplet
        session={session}
        html={props.html}
        gid={gid}
        state={group.state}
      />
      <div className="avatars">
        {members.map((m) => (
          <Avatar key={m} session={session} uid={m} />
        ))}
      </div>
    </>
  );
}

function GroupApplet({
  session,
  html,
  gid,
  state,
}: {
  session: string;
  html: string;
  gid: string;
  state?: StoredState;
}) {
  const write = useThrottledWriter((s: StoredState) =>
    writeGroupState(session, gid, s).catch(() => {}),
  );
  return <AppletFrame html={html} state={state ?? null} onUpdate={write} />;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function Avatar({ session, uid }: { session: string; uid: string }) {
  const name = useValue<Student>(paths.student(session, uid))?.name;
  if (!name) return null;
  return (
    <span className="avatar" aria-label={name} role="img">
      {initials(name)}
    </span>
  );
}

/** The student's own code on top, and a field to join someone else's group. */
function GroupCard({
  session,
  uid,
  gid,
  code: own,
}: {
  session: string;
  uid: string;
  gid: string;
  code: string;
}) {
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBad(false);
    try {
      await joinGroup(session, uid, code, gid);
    } catch {
      setBad(true);
    }
    setBusy(false);
  };

  return (
    <div className="center">
      <form className="group-card" onSubmit={join}>
        <div className="group-code">{own}</div>
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
    </div>
  );
}
