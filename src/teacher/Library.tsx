import { useEffect, useState } from "react";
import { deleteApplet, startSession, uploadApplet } from "../firebase/client";
import { useLibrary } from "../hooks/session";
import { useAuth } from "../hooks/useAuth";

const DELETE_CONFIRM_MS = 3000;

/** The remote's library. Starting an applet makes it the live session, which both teacher pages follow. */
export function Library({ touch }: { touch: boolean }) {
  const user = useAuth();
  const library = useLibrary(user?.uid ?? null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // On touch there is no hover to warn first, so delete asks for a second tap.
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), DELETE_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  const upload = async (files: FileList | null) => {
    setError(null);
    for (const file of Array.from(files ?? [])) {
      try {
        await uploadApplet(await file.text());
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      }
    }
  };

  const start = (id: string) =>
    startSession(id).catch((e) => setError((e as Error).message));

  const applets = Object.entries(library ?? {}).sort(
    ([, a], [, b]) => b.createdAt - a.createdAt,
  );

  return (
    <main
      className="library"
      data-dragging={dragging || undefined}
      onDragOver={(e) => {
        if (touch || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        upload(e.dataTransfer.files);
      }}
    >
      <label className="upload primary">
        Upload applet
        <input
          type="file"
          accept=".html,text/html"
          multiple
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <ul className="applets">
        {applets.map(([id, applet]) => (
          <li key={id} className="applet-card">
            <span className="applet-name">{applet.name}</span>
            <button type="button" className="primary" onClick={() => start(id)}>
              Start
            </button>
            <button
              type="button"
              className={
                armed === id ? "destructive armed" : "quiet destructive"
              }
              aria-label="Delete"
              onClick={() => {
                if (touch && armed !== id) return setArmed(id);
                setArmed(null);
                deleteApplet(id);
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
