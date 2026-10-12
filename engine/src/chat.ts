import type { Database } from "firebase-admin/database";
import type { Manifest } from "../../src/applet/contract.ts";
import { paths } from "../../src/firebase/paths.ts";
import {
  type ChatMessage,
  type Control,
  DEFAULT_CHAT_LIMIT,
} from "../../src/firebase/types.ts";
import type { Claude } from "./claude.ts";

const HISTORY = 40;
const MINUTE = 60_000;

export function chatPrompt(manifest: Manifest, history: ChatMessage[]) {
  const lines = history.map(
    (m) => `${m.role === "user" ? "Student" : "You"}: ${m.text}`,
  );
  return `You are the chatbot for a classroom lesson called "${manifest.title}". A student is talking to you.

The teacher's instructions for you:
${manifest.instructions}

The conversation so far, oldest first:
${lines.join("\n\n")}

Write your next reply to the student. Reply with the message text only.`;
}

/** Answers the latest message in chat/{student} and appends the reply. */
export async function answerChat(
  db: Database,
  claude: Claude,
  session: string,
  student: string,
) {
  const s = paths.session(session);
  const [manifestSnap, controlSnap, chatSnap] = await Promise.all([
    db.ref(`${s}/applet/manifest`).get(),
    db.ref(paths.control(session)).get(),
    db
      .ref(paths.chat(session, student))
      .orderByKey()
      .limitToLast(HISTORY)
      .get(),
  ]);
  const manifest = manifestSnap.val() as Manifest | null;
  if (!manifest) throw new Error("session has no applet");
  if (manifest.instructions === undefined)
    throw new Error("this applet has no chatbot");

  const history: ChatMessage[] = [];
  chatSnap.forEach((m) => {
    history.push(m.val() as ChatMessage);
  });
  // An earlier request already answered it.
  if (history.at(-1)?.role !== "user") return;

  // Students can write requests directly, so the limit is enforced here too.
  const limit =
    (controlSnap.val() as Control | null)?.chatLimit ?? DEFAULT_CHAT_LIMIT;
  const since = Date.now() - MINUTE;
  const recent = history.filter(
    (m) => m.role === "assistant" && m.at > since,
  ).length;
  if (limit > 0 && recent >= limit) throw new Error("chat limit reached");

  const text = await claude(chatPrompt(manifest, history));
  const reply: ChatMessage = { role: "assistant", text, at: Date.now() };
  await db.ref(paths.chat(session, student)).push(reply);
}
