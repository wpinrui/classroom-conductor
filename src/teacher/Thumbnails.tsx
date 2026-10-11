import { AppletFrame } from "../applet/AppletFrame";
import { requestPulse, setControl } from "../firebase/client";
import type { Session } from "../firebase/types";

/** Live, view-only thumbnails of every student. Doubles as the Spotlight and Gallery picker. */
export function Thumbnails({
  session,
  data,
}: {
  session: string;
  data: Session;
}) {
  const { mode, spotlight, gallery = {} } = data.control;
  const pickOne = mode === "spotlight" || mode === "anonymousSpotlight";
  const pickMany = mode === "gallery";
  const pending = new Set(
    Object.values(data.pulses ?? {})
      .filter((p) => p.student && p.status === "pending")
      .map((p) => p.student),
  );
  const students = Object.entries(data.students ?? {}).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name),
  );

  const select = (uid: string) => {
    if (pickOne) setControl(session, { spotlight: uid });
    else {
      const next = { ...gallery };
      if (next[uid]) delete next[uid];
      else next[uid] = true;
      setControl(session, { gallery: next });
    }
  };

  return (
    <ul className="thumbs">
      {students.map(([uid, s]) => (
        <li
          key={uid}
          className="thumb"
          data-offline={!data.presence?.[uid] || undefined}
        >
          <div className="thumb-view">
            <AppletFrame
              html={data.applet.html}
              state={data.states?.[uid] ?? null}
              interactive={false}
              className="thumb-frame"
            />
          </div>
          <span className="thumb-name">{s.name}</span>
          {(pickOne || pickMany) && (
            <button
              type="button"
              className="thumb-pick"
              aria-label={s.name}
              aria-pressed={pickOne ? spotlight === uid : !!gallery[uid]}
              onClick={() => select(uid)}
            />
          )}
          <button
            type="button"
            className="thumb-pulse"
            disabled={pending.has(uid)}
            onClick={() => requestPulse(session, uid)}
          >
            Pulse
          </button>
        </li>
      ))}
    </ul>
  );
}
