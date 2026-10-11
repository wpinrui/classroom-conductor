import { AppletFrame } from "../applet/AppletFrame";
import { paths } from "../firebase/paths";
import type { Student } from "../firebase/types";
import { useControl, useStudentState } from "../hooks/session";
import { useValue } from "../hooks/useValue";
import { OwnApplet, type StageProps } from "./OwnApplet";

/** Another student's screen, view-only, optionally captioned with their name. */
function Screen({
  session,
  html,
  student,
  named,
}: {
  session: string;
  html: string;
  student: string;
  named: boolean;
}) {
  const state = useStudentState(session, student);
  const info = useValue<Student>(
    named ? paths.student(session, student) : null,
  );
  if (state === undefined) return null;
  return (
    <figure className="screen">
      <AppletFrame html={html} state={state} interactive={false} />
      {named && info && <figcaption>{info.name}</figcaption>}
    </figure>
  );
}

function spotlight(named: boolean) {
  return function SpotlightView(props: StageProps) {
    const control = useControl(props.session);
    const target = control?.spotlight;
    // The spotlighted student keeps working on their own applet.
    if (!target || target === props.uid) return <OwnApplet {...props} />;
    return (
      <Screen
        session={props.session}
        html={props.html}
        student={target}
        named={named}
      />
    );
  };
}

export const SpotlightView = spotlight(true);
export const AnonymousSpotlightView = spotlight(false);

/** Gallery: the chosen students side by side. */
export function GalleryView(props: StageProps) {
  const control = useControl(props.session);
  const chosen = Object.keys(control?.gallery ?? {});
  if (chosen.length === 0) return <OwnApplet {...props} />;
  return (
    <div className="gallery">
      {chosen.map((uid) => (
        <Screen
          key={uid}
          session={props.session}
          html={props.html}
          student={uid}
          named
        />
      ))}
    </div>
  );
}
