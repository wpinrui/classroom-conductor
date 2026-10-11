import { useState } from "react";
import { formGroups, moveToGroup, setControl } from "../firebase/client";
import type { Session } from "../firebase/types";

const DEFAULT_GROUP_SIZE = 3;
const MIN_GROUP_SIZE = 2;

/** Group size, random forming, and drag-to-rearrange. */
export function Groups({ session, data }: { session: string; data: Session }) {
  const size = data.control.groupSize ?? DEFAULT_GROUP_SIZE;
  const students = data.students ?? {};
  const groups = Object.entries(data.groups ?? {});
  const ungrouped = Object.keys(students).filter(
    (uid) => !students[uid].group || !data.groups?.[students[uid].group ?? ""],
  );
  const [over, setOver] = useState<string | null>(null);

  const drop = (to: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const uid = e.dataTransfer.getData("text/plain");
    if (!students[uid]) return;
    const fromId = students[uid].group;
    const from = fromId && data.groups?.[fromId];
    if ((from ? fromId : null) === to) return;
    moveToGroup(session, uid, from ? { ...from, id: fromId } : null, to);
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
        <label className="field">
          Group size
          <input
            type="number"
            min={MIN_GROUP_SIZE}
            value={size}
            onChange={(e) =>
              setControl(session, {
                groupSize: Math.max(MIN_GROUP_SIZE, +e.target.value || 0),
              })
            }
          />
        </label>
        <button
          type="button"
          disabled={Object.keys(students).length === 0}
          onClick={() => formGroups(session, Object.keys(students), size)}
        >
          Form
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
          +
        </ul>
      )}
      {ungrouped.length > 0 && (
        <ul className="group loose" {...zone("loose", null)}>
          {ungrouped.map(chip)}
        </ul>
      )}
    </div>
  );
}
