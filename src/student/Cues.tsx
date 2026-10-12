/** Inset edge around the viewport. Watch means view-only, live means "you are on screen". */
export function Edge({ kind }: { kind: "watch" | "live" }) {
  return <div className={`edge edge-${kind}`} />;
}

/** Shown while a view loads. The dot appears only if loading drags on. */
export function Loading() {
  return (
    <div className="loading">
      <span />
    </div>
  );
}

/** Freeze: a dim scrim over the student's own applet. The mode pill carries the lock. */
export function Frozen() {
  return <div className="freeze-scrim" />;
}

function LockIcon() {
  return (
    <svg
      className="pill-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/**
 * The class mode, and whose screen this is when it is not the student's own.
 * Live marks the student whose screen the class is watching.
 */
export function ModePill({
  mode,
  who,
  live,
}: {
  mode: string;
  who?: string;
  live?: boolean;
}) {
  return (
    <div className="name-pill" data-live={live || undefined}>
      {mode === "Freeze" && <LockIcon />}
      <span className="pill-mode">{mode}</span>
      {who && <span className="pill-who">{who}</span>}
    </div>
  );
}
