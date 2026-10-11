import { useState } from "react";
import { useNavigate } from "react-router";
import { deleteApplet, startSession, uploadApplet } from "../firebase/client";
import { useLibrary } from "../hooks/session";
import { useAuth } from "../hooks/useAuth";
import { routes } from "../routes";

export function Library() {
  const user = useAuth();
  const library = useLibrary(user?.uid ?? null);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

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

  const start = async (id: string) => {
    const { session } = await startSession(id);
    navigate(routes.teach(session));
  };

  const applets = Object.entries(library ?? {}).sort(
    ([, a], [, b]) => b.createdAt - a.createdAt,
  );

  return (
    <main className="library">
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
              className="quiet"
              aria-label="Delete"
              onClick={() => deleteApplet(id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
