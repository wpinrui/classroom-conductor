import { get, ref, set, update } from "firebase/database";
import { randomCode } from "../firebase/client";
import { db } from "../firebase/config";
import { paths } from "../firebase/paths";
import type { Group } from "../firebase/types";

// A group's id is its join code, so joining is a direct lookup.
const GROUP_CODE_LENGTH = 4;

const pointer = (session: string, uid: string) =>
  ref(db, `${paths.student(session, uid)}/group`);

export class GroupError extends Error {}

/** Creates a group with the student as its only member and moves them into it. */
export async function createGroup(session: string, uid: string) {
  for (let attempt = 0; ; attempt++) {
    const code = randomCode(GROUP_CODE_LENGTH);
    const group: Group = { code, members: { [uid]: true }, count: 1 };
    try {
      // The rules refuse to overwrite an existing group, so a collision throws.
      await set(ref(db, paths.group(session, code)), group);
    } catch (e) {
      if (attempt < 4) continue;
      throw e;
    }
    await set(pointer(session, uid), code);
    return code;
  }
}

/** Moves the student into the group with this code. The rules enforce the size cap. */
export async function joinGroup(
  session: string,
  uid: string,
  raw: string,
  from?: string,
) {
  const gid = raw.trim().toUpperCase();
  if (!gid) throw new GroupError();
  const snap = await get(ref(db, paths.group(session, gid))).catch(() => null);
  if (!snap?.exists()) throw new GroupError();
  const group = snap.val() as Group;
  if (!group.members?.[uid]) {
    try {
      await update(ref(db, paths.group(session, gid)), {
        [`members/${uid}`]: true,
        count: (group.count ?? 0) + 1,
      });
    } catch {
      throw new GroupError();
    }
  }
  await set(pointer(session, uid), gid);
  // Leaving the old group is tidy-up. The move has already happened.
  if (from && from !== gid)
    await leaveGroup(session, uid, from).catch(() => {});
}

/** Removes the student from a group's members. */
async function leaveGroup(session: string, uid: string, gid: string) {
  const snap = await get(ref(db, paths.group(session, gid)));
  const group = snap.val() as Group | null;
  if (!group?.members?.[uid]) return;
  await update(ref(db, paths.group(session, gid)), {
    [`members/${uid}`]: null,
    count: (group.count ?? 1) - 1,
  });
}
