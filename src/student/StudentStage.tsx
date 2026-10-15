import { AppletFrame, TeacherStateContext } from "../applet/AppletFrame";
import { Chat } from "../chat/Chat";
import type { Control } from "../firebase/types";
import {
  useAppletHtml,
  useControl,
  useSessionApplet,
  useTeacherState,
} from "../hooks/session";
import { Countdown } from "../timer/Countdown";
import { Edge, Loading, Status } from "./Cues";
import { OwnApplet, type StageProps } from "./OwnApplet";
import "./student.css";
import { Screen, useName } from "./Watch";

/** Demo: the teacher's applet, live and view-only. */
export function DemoView({ session, html }: StageProps) {
  const teacher = useTeacherState(session);
  if (teacher === undefined) return <Loading />;
  return (
    <>
      <AppletFrame
        html={html}
        state={teacher}
        interactive={false}
        owner="teacher"
      />
      <Edge kind="watch" />
    </>
  );
}

/** Tells the student whose screen they see, or that the class sees theirs. Nothing on their own work. */
function StudentStatus({
  session,
  uid,
  control,
}: {
  session: string;
  uid: string;
  control: Control;
}) {
  const spotlight = control.spotlight ?? null;
  const name = useName(session, spotlight !== uid ? spotlight : null);
  if (spotlight === uid)
    return (
      <Status tone="live">
        <b>You're on screen</b>
      </Status>
    );
  if (spotlight)
    return name ? (
      <Status tone="watch">
        <span>
          Viewing <b>{name}'s</b> screen
        </span>
      </Status>
    ) : null;
  if (control.mode === "demo")
    return (
      <Status tone="watch">
        <span>
          Viewing the <b>teacher's</b> screen
        </span>
      </Status>
    );
  return null;
}

export function StudentStage({ session, uid, me }: Omit<StageProps, "html">) {
  const control = useControl(session);
  const applet = useSessionApplet(session);
  const teacher = useTeacherState(session);
  const html = useAppletHtml(session, applet?.html);
  if (!control || !applet || !html)
    return (
      <main className="stage">
        <Loading />
      </main>
    );
  const props = { session, uid, me, html };
  const spotlight = control.spotlight;
  // The spotlighted student keeps working on their own applet, so the class can watch.
  const own = spotlight ? spotlight === uid : control.mode === "work";
  const dark = !!control.dark;
  return (
    <main className="stage">
      <TeacherStateContext.Provider value={teacher ?? null}>
        <div className="view" key={own ? "own" : (spotlight ?? "demo")}>
          {own ? (
            <OwnApplet {...props} reset={control.reset} />
          ) : spotlight ? (
            <Screen session={session} html={html} student={spotlight} />
          ) : (
            <DemoView {...props} />
          )}
          {spotlight && <Edge kind={own ? "live" : "watch"} />}
        </div>
      </TeacherStateContext.Provider>
      {!dark && (
        <div className="status-bar">
          <StudentStatus session={session} uid={uid} control={control} />
          {control.timer && <Countdown timer={control.timer} />}
        </div>
      )}
      {dark && <div className="focus" />}
      {!dark && applet.manifest.instructions !== undefined && (
        <Chat session={session} uid={uid} />
      )}
    </main>
  );
}
