import { useState } from "react";
import { formGroups, moveToGroup, setControl } from "../firebase/client";
import type { Session } from "../firebase/types";
import { GroupIcon } from "./icons";
import { Stepper } from "./Stepper";

const DEFAULT_GROUP_SIZE = 3;
const MIN_GROUP_SIZE = 2;

/** Group size, Shuffle, and drag-to-rearrange. */
export function Groups({ session, data }: { session: string; data: Session }) {
  const size = data.control.groupSize ?? DEFAULT_GROUP_SIZE;
  const students = data.students ?? {};
  const uids = Object.keys(students);
  const groups = Object.entries(data.groups ?? {});
  const groupOf = (uid: string) => {
    const g = students[uid].group;
    return g && data.groups?.[g] ? g : null;
  };
  const ungrouped = uids.filter((uid) => !groupOf(uid));
  const [over, setOver] = useState<string | null>(null);

  const drop = (to: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const uid = e.dataTransfer.getData("text/plain");
    if (!students[uid]) return;
    const fromId = groupOf(uid);
    if (fromId === to) return;
    const g = fromId ? data.groups?.[fromId] : undefined;
    const from = fromId && g ? { ...g, id: fromId } : null;
    moveToGroup(session, uid, from, to);
  };

  const zone = (key: string, to: string | null) => ({
    "data-over": over === key || undefined,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(key);
    },
    onDragLeave: () => setOver(null),
    onDrop: drop(to),
  });

  const chip = (uid: string) => (
    <li
      key={uid}
      className="chip"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", uid)}
    >
      {students[uid].name}
    </li>
  );

  return (
    <div className="groups">
      <div className="row">
        <Stepper
          label={
            <span className="stepper-label" role="img" aria-label="Group size">
              <GroupIcon />
            </span>
          }
          value={size}
          current={size}
          min={MIN_GROUP_SIZE}
          onStep={(d) => setControl(session, { groupSize: size + d })}
        />
        <button
          type="button"
          disabled={uids.length === 0}
          onClick={() => formGroups(session, uids, size)}
        >
          Shuffle
        </button>
      </div>
      {groups.map(([gid, g]) => (
        <ul key={gid} className="group" {...zone(gid, gid)}>
          {Object.keys(g.members)
            .filter((uid) => students[uid])
            .map(chip)}
        </ul>
      ))}
      {groups.length > 0 && (
        <ul
          className="group new"
          aria-label="New group"
          {...zone("new", "new")}
        >
          <li>+</li>
        </ul>
      )}
      {ungrouped.length > 0 && groups.length > 0 && (
        <ul
          className="group loose"
          aria-label="No group"
          {...zone("loose", null)}
        >
          {ungrouped.map(chip)}
        </ul>
      )}
    </div>
  );
}
