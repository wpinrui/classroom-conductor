import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sendChat } from "../firebase/client";
import { useChat, useControl } from "../hooks/session";
import { chatCooldown } from "./rateLimit";
import "./chat.css";

/** The student's chatbot: a launcher bottom right that opens a drawer. */
export function Chat({ session, uid }: { session: string; uid: string }) {
  const control = useControl(session);
  const chat = useChat(session, uid);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const messages = Object.entries(chat ?? {})
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, m]) => ({ id, ...m }));
  const last = messages.at(-1);
  const lastReply = messages.findLast((m) => m.role === "assistant")?.at ?? 0;
  const pending = last?.role === "user";
  const unread = !open && lastReply > seen;
  const sent = messages.filter((m) => m.role === "user").map((m) => m.at);
  const cooldown = chatCooldown(sent, control?.chatLimit, now);

  // Replies already there on load count as read.
  const loaded = chat !== undefined;
  const primed = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    if (open || !primed.current) setSeen(lastReply);
    primed.current = true;
  }, [open, loaded, lastReply]);

  const until = cooldown?.until;
  useEffect(() => {
    if (!until) return;
    const t = setTimeout(() => setNow(Date.now()), until - Date.now());
    return () => clearTimeout(t);
  }, [until]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when a message arrives
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "end" });
  }, [open, messages.length, pending]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-grow; CSS caps the height at six lines.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resize on every draft change
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const text = draft.trim();
  const canSend = Boolean(text) && !cooldown;

  const send = async () => {
    if (!canSend) return;
    setFailed(false);
    setDraft("");
    setNow(Date.now());
    try {
      await sendChat(session, text);
    } catch {
      setDraft(text);
      setFailed(true);
    }
  };

  return (
    <>
      <button
        type="button"
        className="chat-launcher"
        aria-label="Chat"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <SpeechIcon />
        {unread && <span className="chat-unread" />}
      </button>
      <aside className="chat-drawer" data-open={open} inert={!open}>
        <button
          type="button"
          className="quiet chat-close"
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
        <div className="chat-log">
          {messages.map((m) => (
            <p key={m.id} className={`chat-message chat-${m.role}`}>
              {m.text}
            </p>
          ))}
          {pending && (
            <span className="chat-typing" role="status" aria-label="Replying">
              <i />
              <i />
              <i />
            </span>
          )}
          <div ref={end} />
        </div>
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={input}
            rows={1}
            aria-label="Message"
            maxLength={4000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            type="submit"
            className="chat-send"
            aria-label="Send"
            aria-invalid={failed}
            disabled={!canSend}
          >
            {cooldown && (
              <svg className="chat-cooldown" viewBox="0 0 52 52" aria-hidden>
                <circle
                  key={cooldown.until}
                  cx="26"
                  cy="26"
                  r="24"
                  pathLength={100}
                  style={{
                    animationDuration: `${cooldown.until - cooldown.start}ms`,
                    animationDelay: `${cooldown.start - now}ms`,
                  }}
                />
              </svg>
            )}
            <ArrowIcon />
          </button>
        </form>
      </aside>
    </>
  );
}

function SpeechIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <path
        d="M4 5h16v11H9l-5 4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        d="M12 19V5M5 12l7-7 7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
