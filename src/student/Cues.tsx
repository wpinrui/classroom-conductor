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

/** Freeze: a dim scrim over the student's own applet. */
export function Frozen() {
  return <div className="freeze-scrim" />;
}

export function LockIcon() {
  return (
    <svg
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

/** A chip in the top-middle status bar. Watch means view-only, live means the class is watching this student. */
export function Status({
  tone,
  children,
}: {
  tone?: "watch" | "live";
  children: React.ReactNode;
}) {
  return (
    <div className="status" data-tone={tone}>
      {children}
    </div>
  );
}
