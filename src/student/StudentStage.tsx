import { AppletFrame } from "../applet/AppletFrame";
import type { Control, Mode } from "../firebase/types";
import { GroupView } from "./GroupView";
import { OwnApplet, type OwnProps, type StageProps } from "./OwnApplet";
import "./student.css";
import {
  useControl,
  useSessionApplet,
  useTeacherState,
} from "../hooks/session";
import { AnonymousSpotlightView, GalleryView, SpotlightView } from "./Watch";

/** Demo: the teacher's applet, live and view-only. */
export function DemoView({ session, html }: StageProps) {
  const teacher = useTeacherState(session);
  if (teacher === undefined) return null;
  return <AppletFrame html={html} state={teacher} interactive={false} />;
}

/** Focus: the screen goes dark. */
function FocusView() {
  return <div className="focus" />;
}

/** Reveal: the teacher's chosen state, view-only. */
function RevealView({ session, html }: StageProps) {
  const control = useControl(session);
  return (
    <AppletFrame html={html} state={control?.reveal} interactive={false} />
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
  // Freeze: the student's own work, view-only.
  freeze: () => ({ interactive: false }),
};

const views: Partial<Record<Mode, (p: StageProps) => React.ReactNode>> = {
  demo: DemoView,
  spotlight: SpotlightView,
  anonymousSpotlight: AnonymousSpotlightView,
  gallery: GalleryView,
  group: GroupView,
  focus: FocusView,
  reveal: RevealView,
};

export function StudentStage({ session, uid, me }: Omit<StageProps, "html">) {
  const control = useControl(session);
  const applet = useSessionApplet(session);
  if (!control || !applet) return null;
  const props = { session, uid, me, html: applet.html };
  const ownProps = own[control.mode];
  const View = views[control.mode];
  return (
    <main className="stage">
      {ownProps || !View ? (
        <OwnApplet {...props} {...ownProps?.(control)} />
      ) : (
        <View {...props} />
      )}
    </main>
  );
}
