import { AppletFrame } from "../applet/AppletFrame";
import { paths } from "../firebase/paths";
import type { Student } from "../firebase/types";
import { useControl, useStudentState } from "../hooks/session";
import { useValue } from "../hooks/useValue";
import { Edge, Loading } from "./Cues";
import { OwnApplet, type StageProps } from "./OwnApplet";

/** Another student's applet, view-only. */
function Screen({
  session,
  html,
  student,
}: {
  session: string;
  html: string;
  student: string;
}) {
  const state = useStudentState(session, student);
  if (state === undefined) return <Loading />;
  return <AppletFrame html={html} state={state} interactive={false} />;
}

function useName(session: string, student: string | null) {
  return useValue<Student>(student && paths.student(session, student))?.name;
}

function spotlight(named: boolean) {
  return function SpotlightView(props: StageProps) {
    const control = useControl(props.session);
    const target = control?.spotlight ?? null;
    const name = useName(props.session, named ? target : null);
    if (!target) return <OwnApplet {...props} />;
    // The spotlighted student keeps working on their own applet.
    if (target === props.uid)
      return (
        <>
          <OwnApplet {...props} />
          <Edge kind="live" />
        </>
      );
    return (
      <>
        <Screen session={props.session} html={props.html} student={target} />
        <Edge kind="watch" />
        {name && <div className="name-pill">{name}</div>}
      </>
    );
  };
}

export const SpotlightView = spotlight(true);
export const AnonymousSpotlightView = spotlight(false);

function Tile({
  session,
  html,
  student,
}: {
  session: string;
  html: string;
  student: string;
}) {
  const name = useName(session, student);
  return (
    <figure className="tile">
      <Screen session={session} html={html} student={student} />
      <figcaption>{name}</figcaption>
    </figure>
  );
}

/** Gallery: the chosen students side by side. */
export function GalleryView(props: StageProps) {
  const control = useControl(props.session);
  const chosen = Object.keys(control?.gallery ?? {});
  if (chosen.length === 0) return <OwnApplet {...props} />;
  return (
    <div className="gallery">
      {chosen.map((uid) => (
        <Tile
          key={uid}
          session={props.session}
          html={props.html}
          student={uid}
        />
      ))}
    </div>
  );
}
