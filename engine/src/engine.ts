import type { Database, DataSnapshot, Query } from "firebase-admin/database";
import { paths } from "../../src/firebase/paths.ts";
import type { EngineRequest } from "../../src/firebase/types.ts";
import { answerChat } from "./chat.ts";
import type { Claude } from "./claude.ts";
import { type CodeCache, producePulse } from "./pulse.ts";

export interface EngineOptions {
  db: Database;
  claude: Claude;
  cache: CodeCache;
  /** Requests handled at once across every session. */
  concurrency?: number;
  log?: (line: string) => void;
}

/**
 * Watches /live for running sessions and answers each one's pending requests.
 * Returns a function that stops watching.
 */
export function startEngine({
  db,
  claude,
  cache,
  concurrency = 2,
  log = console.log,
}: EngineOptions) {
  const watched = new Map<string, Query>();
  const seen = new Set<string>();
  const queue: (() => Promise<void>)[] = [];
  let running = 0;

  const drain = () => {
    while (running < concurrency && queue.length) {
      const job = queue.shift() as () => Promise<void>;
      running++;
      job()
        .catch((e) => log(`could not record a result: ${String(e)}`))
        .finally(() => {
          running--;
          drain();
        });
    }
  };

  const handle = async (session: string, id: string, req: EngineRequest) => {
    const ref = db.ref(`${paths.requests(session)}/${id}`);
    try {
      if (req.kind === "chat")
        await answerChat(db, claude, session, req.student);
      else if (req.kind === "pulse")
        await producePulse(db, claude, cache, session, req.pulse);
      else throw new Error("unknown request kind");
      await ref.update({ status: "done" });
      log(`${session} ${req.kind} done`);
    } catch (e) {
      log(
        `${session} ${req.kind} failed: ${typeof e === "string" ? e : String((e as Error).message)}`,
      );
      await ref.update({ status: "error" });
      if (req.kind === "pulse")
        await db
          .ref(paths.pulse(session, req.pulse))
          .update({ status: "error" });
    } finally {
      seen.delete(`${session}/${id}`);
    }
  };

  const onRequest = (session: string) => (snap: DataSnapshot) => {
    const id = snap.key as string;
    if (seen.has(`${session}/${id}`)) return;
    seen.add(`${session}/${id}`);
    queue.push(() => handle(session, id, snap.val() as EngineRequest));
    drain();
  };

  const live = db.ref("live");
  const onLive = (snap: DataSnapshot) => {
    const session = snap.key as string;
    if (watched.has(session)) return;
    const pending = db
      .ref(paths.requests(session))
      .orderByChild("status")
      .equalTo("pending");
    pending.on("child_added", onRequest(session));
    watched.set(session, pending);
    log(`${session} watching`);
  };
  const onEnd = (snap: DataSnapshot) => {
    const session = snap.key as string;
    watched.get(session)?.off();
    watched.delete(session);
    log(`${session} ended`);
  };
  live.on("child_added", onLive);
  live.on("child_removed", onEnd);

  return () => {
    live.off();
    for (const q of watched.values()) q.off();
    watched.clear();
  };
}
