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
