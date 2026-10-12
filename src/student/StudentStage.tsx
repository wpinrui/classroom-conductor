import { AppletFrame, TeacherStateContext } from "../applet/AppletFrame";
import { Chat } from "../chat/Chat";
import type { Control, Mode } from "../firebase/types";
import {
  useControl,
  useSessionApplet,
  useTeacherState,
} from "../hooks/session";
import { Countdown } from "../timer/Countdown";
import { Edge, Frozen, Loading } from "./Cues";
import { GroupView } from "./GroupView";
import { OwnApplet, type OwnProps, type StageProps } from "./OwnApplet";
import "./student.css";
import { AnonymousSpotlightView, GalleryView, SpotlightView } from "./Watch";

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

/** Reveal: the teacher's chosen state, view-only. */
function RevealView({ session, html }: StageProps) {
  const control = useControl(session);
  return (
    <>
      <AppletFrame html={html} state={control?.reveal} interactive={false} />
      <Edge kind="watch" />
    </>
  );
}

/**
 * Modes that show the student's own applet. They share one component so
 * switching between them keeps the applet loaded.
 */
const own: Partial<Record<Mode, (c: Control) => OwnProps>> = {
  independent: () => ({}),
  // Paced: the student works freely up to the teacher's phase.
  paced: (c) => ({ maxPhase: c.pacedPhase ?? null }),
  freeze: () => ({ interactive: false }),
};

const views: Partial<Record<Mode, (p: StageProps) => React.ReactNode>> = {
  demo: DemoView,
  reveal: RevealView,
  spotlight: SpotlightView,
  anonymousSpotlight: AnonymousSpotlightView,
  gallery: GalleryView,
  group: GroupView,
};

export function StudentStage({ session, uid, me }: Omit<StageProps, "html">) {
  const control = useControl(session);
  const applet = useSessionApplet(session);
  const teacher = useTeacherState(session);
  if (!control || !applet)
    return (
      <main className="stage">
        <Loading />
      </main>
    );
  const mode = control.mode;
  const props = { session, uid, me, html: applet.html };
  const ownProps = own[mode];
  const View = views[mode];
  // Focus keeps the student's applet loaded underneath the blackout.
  const showOwn = Boolean(ownProps) || !View;
  return (
    <main className="stage">
      <TeacherStateContext.Provider value={teacher ?? null}>
        <div className="view" key={showOwn ? "own" : mode}>
          {showOwn ? (
            <OwnApplet {...props} {...ownProps?.(control)} />
          ) : (
            View && <View {...props} />
          )}
        </div>
      </TeacherStateContext.Provider>
      {mode === "freeze" && <Frozen />}
      {control.timer && mode !== "focus" && <Countdown timer={control.timer} />}
      {mode === "focus" && <div className="focus" />}
      {mode !== "focus" && applet.manifest.instructions !== undefined && (
        <Chat session={session} uid={uid} />
      )}
    </main>
  );
}
