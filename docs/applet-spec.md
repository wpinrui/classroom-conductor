# Classroom Conductor applet spec

This document is everything needed to build an applet for Classroom Conductor. Nothing else is required.

Classroom Conductor is a website a teacher runs a lesson with. The lesson itself is an **applet**: one HTML page. Every student runs their own copy of the applet. The teacher runs one too. The Conductor stores each copy's state, shows students each other's screens, and gives the teacher class tools.

Rules marked **Required** are enforced by the Conductor. Break one and the upload fails, work is lost, or the teacher's controls break. Rules marked **Recommended** make the applet good to teach with.

## 1. How a lesson runs

The teacher uploads the HTML file and starts a session. Students join with a code and a name. The teacher then switches the class between modes. Every mode works with every applet, so the applet never needs to know the mode. An applet can still narrow the modes each phase offers (section 3).

| Mode | What happens |
| --- | --- |
| Independent | Each student works in their own applet. |
| Demo | Students watch the teacher's applet live. |
| Handoff | Offered only during Demo. Every student's state is replaced by the teacher's current state, then the class goes Independent. |
| Spotlight | Everyone watches one student's applet, labelled with their name. Anonymous Spotlight labels it "Classmate" instead. The spotlighted student sees "You". |
| Gallery | Several students' applets are shown side by side on everyone's screen. |
| Group | Several students edit one shared state together. |
| Paced | The teacher sets the highest phase students may reach. |
| Freeze | Students see their work but cannot change it. |
| Focus | Student screens go dark. |
| Reveal | Every student sees one state, view only. It is the teacher's state or one of the applet's prepared states. |

The teacher also gets thumbnails of every student's applet, a name wheel, a countdown timer, a chatbot for students, and a Pulse that summarises the class's states.

Consequences for the applet:

- The same file renders the teacher's state and every student's state. Teacher and students share one state shape, because Handoff copies the teacher's state into every student.
- Many frames render a state they did not create: thumbnails, Spotlight, Gallery, Demo and Reveal. Those frames receive only the state, the phase and a context object.

## 2. The file

**Required**

- One HTML file. Every script, style, image and font is inline.
- It runs in an iframe with `sandbox="allow-scripts allow-forms allow-modals"`. The origin is opaque, so `localStorage`, `sessionStorage`, cookies and IndexedDB throw or fail. Popups, downloads and navigating the top page are blocked.
- Nothing survives a reload except the state (section 4).
- Ctrl+., Cmd+. and the middle mouse button are taken by the Conductor before the applet's handlers see them. Do not bind them.
- In the teacher's own frame of an applet with `slides`, S is taken too. While the slideshow is on, so are the scroll wheel, PageDown, PageUp, ArrowDown, ArrowUp and Space. Keys typed into a text field are left alone (section 6, Slideshow).

**Outside network**

- Images load from any site.
- `fetch` reaches a site only if it answers with `Access-Control-Allow-Origin: *`, because the frame's origin is `null`. A site that lists specific allowed origins rejects it. pokeapi.co is an example that works.
- A fetched site can be down or blocked by the school network. Inline anything the lesson cannot run without. Show a usable screen while a fetch is pending and after it fails.

**Recommended**

- Design for a 1280 pixel wide viewport. Thumbnails render the applet at 1280 pixels and scale it down.
- Fit the window, not just the width. Screens and projectors are often shorter than the layout, so scale the page down until it fits rather than letting the bottom fall off.
- Make the screen readable from the back of a room. It is projected in Demo, Spotlight and Reveal.
- Keep the top 48 pixels clear of anything important. The Conductor shows a small status bar at the top middle, such as whose screen is shown and the countdown.

## 3. The manifest

Declare the manifest in a JSON script tag, anywhere in the file:

```html
<script type="application/json" id="conductor-manifest">
{
  "title": "Where is 3/8?",
  "phases": ["Place", "Explain"],
  "instructions": "Help the student place 3/8 on a number line ...",
  "pulsePrompt": "Each state has x, a number from 0 to 1 ...",
  "namelist": ["Ann Lee", "Bo Tan"],
  "preparedStates": [{ "name": "Read as digits", "state": { "x": 0.38, "note": "" }, "phase": 1 }],
  "modes": [["independent", "spotlight"], ["independent", "reveal"]],
  "slides": [
    { "label": "First question", "cue": "question 1" },
    { "label": "Pick someone", "wheel": { "spin": true } },
    { "label": "Explain", "phase": 1, "mode": "independent", "timer": 120 },
    { "label": "Show the wrong answer", "reveal": "Read as digits" }
  ]
}
</script>
```

**Required.** The upload is rejected unless all of these hold.

| Field | Rule |
| --- | --- |
| tag | A `<script>` with `id="conductor-manifest"` (single or double quotes). The first `</script>` after it ends the manifest, so write `<\/script>` inside any string that needs it. |
| body | Valid JSON, and an object. |
| `title` | Non-empty string. |
| `phases` | Non-empty list of strings. Phases are referred to by index everywhere else. |
| `instructions` | Optional string. |
| `pulsePrompt` | Optional string. |
| `namelist` | Optional list of strings. |
| `preparedStates` | Optional list of `{ name, state, phase }`. `name` is a string. `state` must be present. `phase` is an integer from 0 to the number of phases minus 1. |
| `handoff` | Optional boolean. |
| `modes` | Optional list with exactly one entry per phase. Each entry is a non-empty list of mode ids: `independent`, `demo`, `spotlight`, `anonymousSpotlight`, `gallery`, `group`, `paced`, `freeze`, `focus`, `reveal`. |
| `slides` | Optional list of step objects. Each step needs `label`, a non-empty string. Every other field is optional. `phase` is an integer from 0 to the number of phases minus 1. `mode` is one of the mode ids above. `cue` is a non-empty string. `wheel` is an object with an optional string `filter` and an optional boolean `spin`. `timer` is a number of seconds above 0 and at most 86,400. `timerShared` is a boolean. `reveal` is the `name` of a prepared state, and a step with `reveal` may set `mode` only to `reveal`. |

**What each field does**

- `title` names the applet in the teacher's library and in the chatbot and Pulse prompts.
- `phases` are the applet's pages. Phase names appear only on the teacher's Paced stepper. Students never see them, so a name may reveal what the phase is for.
- `instructions` switches the student chatbot on and shapes it (section 7). Leave it out to switch the chatbot off.
- `pulsePrompt` switches the Pulse on and specifies it (section 7). Leave it out to switch the Pulse off.
- An empty string keeps a feature on with no guidance. Leave the field out instead.
- `namelist` locks the session to those names. A student must type one to join. Matching ignores case, surrounding spaces and repeated spaces. Leave it out to let any name join.
- `preparedStates` become buttons in the teacher's Reveal picker, labelled by `name`. The picker shows only the prepared states whose `phase` is the teacher's current phase. Keep names short and unique.
- Prepared states arrive exactly as written.
- `modes` narrows the modes the teacher is offered in each phase. The phase is the teacher's own phase.
- The first mode in each list is that phase's default.
- When the teacher's phase changes to one that does not allow the current mode, the class switches to the new phase's default. The same happens when a session starts.
- A scripted spotlight in a phase that does not allow Spotlight is undone straight away.
- Handoff is offered only during Demo, so a phase that does not allow Demo never shows it.
- Leave `modes` out to offer every mode in every phase.
- `handoff: false` hides the Handoff button. Leave it out to offer Handoff during Demo.
- `slides` scripts the lesson for the teacher's slideshow (section 6, Slideshow). Leave it out and the teacher gets no slideshow.
- A step's `label` is what the teacher sees as the next step. Students never see it.
- `phase` holds from its step until a later step names another. Steps before the first `phase` leave the phase as it is.
- `mode` holds the same way. A `reveal` step counts as mode `reveal` showing that prepared state.
- `cue` names an action the applet performs in the teacher's frame, through the `slide` handler.
- `wheel` drives the name wheel exactly like `host.wheel`. `timer` starts a countdown exactly like `host.timer`, shared with students unless `timerShared` is `false`. Both run only when the teacher steps forward onto the step.
- A step with only a `label` is a gap. The slideshow holds there while the teacher acts by hand.
- When a step's mode is not allowed by `modes` in its phase, the class gets that phase's default instead, as for any other mode change.

## 4. The runtime

Before any applet script runs, the Conductor injects a script that defines `window.conductor`.

```js
// Fallback so the file also opens on its own in a browser.
const host = window.conductor ?? { connect() {}, update() {} };

host.connect({
  // Replace the whole state and phase, then render. Never call update here.
  setState(state, phase) {},
  // Optional. The highest phase allowed, or null for no limit.
  setPhaseLimit(maxPhase) {},
  // Optional. Whose state this frame shows and what surrounds it (section 5).
  setContext({ role, teacher, students }) {},
  // Optional. Teacher's own frame only. The name wheel stopped on this student id.
  wheelPicked(studentId) {},
  // Optional. Teacher's own frame only. Move to phase, then apply each cue in order (section 6).
  slide({ phase, cues }) {},
});

// On load, after connect, and after every change to the state or the phase.
host.update(state, phase);
```

Every handler except `setState` is optional. `setContext` arrives before the first `setState` and again whenever it changes.

**Required**

- Call `connect` exactly once, before the first `update`. The host replays the saved state when it hears `connect`, and an earlier `update` could overwrite the student's real work.
- Call `update(state, phase)` on load and after every change to the state or the phase. A student has no saved state until the first `update`.
- Never call `update` from inside `setState`. The host pushed that state and already knows it.
- The state is plain JSON. It is copied with `JSON.parse(JSON.stringify(state))`. Functions, `undefined`, `Map`, `Set` and class instances are lost, and `NaN` becomes `null`.
- The state is the **whole** truth. Rendering it from scratch must reproduce the screen exactly, because other frames receive only the state and phase.
- Keep UI-only details out of the state: hover, scroll, focus, open menus.
- The phase travels beside the state. It is an index into `phases` and is coerced to an integer. Do not store it inside the state as well.
- Moving to another page means calling `update` with the new phase.
- Never move past the phase limit from `setPhaseLimit`. If the applet sends a higher phase anyway, the host rejects it and pushes the last allowed state back.
- `setState` can arrive at any time. In Group mode another student's edit lands while this student is typing. Never reset a text field whose value already matches the state, or the caret jumps.
- Merge every incoming state over your defaults, so a state with missing fields still renders.
- The state as JSON text must stay under 2,000,000 characters, or the database rejects it.
- `$done` is reserved. Set it to `true` when the student has reached what their current phase asks for, and to `false` otherwise. Their thumbnail border turns green while it is `true`. Leave it out in phases with no single goal.

**Recommended**

- Keep the fallback host shown above, so the file opens on its own for testing.
- Keep the state small. Every `update` is written to the database and sent to watchers.
- Treat a missing field as its empty value rather than relying on `null`.
- Disable the next phase control when the limit forbids it, so a student never presses a button that does nothing.

## 5. Context

The applet cannot read the database. The host hands it what it needs through `setContext(context)`.

| Field | Value |
| --- | --- |
| `role` | `"teacher"` when the frame shows the teacher's state. `"student"` otherwise. |
| `teacher` | `{ state, phase }`, the teacher's live state, in every frame with role `"student"` during a session. `null` in teacher frames. |
| `students` | In the teacher's own live frame only: an object mapping each student id to `{ name, phase, state, online }`. `online` is a boolean. `null` everywhere else, including Demo. |

**Required**

- Render without a context. An applet opened on its own never gets one. Default to `{ role: "student", teacher: null, students: null }`.
- Pick the view from `role`, never from who is looking. Demo shows the teacher's state on student devices with role `"teacher"`. Thumbnails and Spotlight show a student's state on the teacher's device with role `"student"`.
- Render from the state and the context together. A frame showing another student's state gets the same `teacher` context, so it can draw the same question.
- Anything drawn from `students` must also work when it is `null`. Copy a summary into the teacher's state when students must see it, such as revealed counts.
- Calling `update` from `setContext` is allowed, because the host did not push that state. Call it only when the state really changed.

**Recommended**

- Keep per question data keyed by an id the teacher's state assigns. A student's answer then stays with its question when the teacher moves on.
- If students follow the teacher's phase, check again after every `setState`, deferred so `update` is not called inside it. The context arrives before the saved state, and the saved state carries the phase it was saved at, which can be behind the teacher. This happens whenever a student's applet reloads, such as after Demo, Spotlight or Reveal.

## 6. Class tools

The teacher's applet can script the name wheel, the timer and the spotlight. Calls take effect only from the teacher's own live frame. The same calls from any other frame are ignored, so a shared file is safe. The teacher can change or close any tool at any time and always wins.

**Required**

- Guard every tool call with `?.` (`host.timer?.(60)`), because the fallback host has none.
- Call a tool in response to something the teacher did, or once when the teacher's frame first gets its context. Never call one from `setState`, because the teacher's frame replays its state on reload. Never call one on every context change, or the teacher's own changes keep being undone.
- Treat every call as a suggestion, never a requirement.

### Filters

```js
host.filters?.([{ name: "Said yes", students: ["uid1", "uid2"] }]);
```

- Names the sets of students the name wheel can spin over. Each entry is `{ name, students }`, where `name` is a non-empty string and `students` lists student ids. Malformed entries are dropped.
- Each call replaces every earlier filter.
- The wheel always offers the whole class. Publish only sets a predicate picks out, never an everyone filter.
- Send it from the teacher's frame when `role === "teacher"` and `students` is present. Republishing on each context change is fine.
- Keep names short and unique, because they become buttons.
- The wheel shows how many students each filter holds. Publish nothing that would leak a hidden result.

### Name wheel

```js
host.wheel?.({ filter: "Said yes", spin: true });
host.wheel?.({ replacement: false });
```

Every option is optional. A missing option leaves the wheel as it is.

| Option | Effect |
| --- | --- |
| `open` | `true` opens the wheel. `false` closes it. |
| `filter` | Selects a filter by name. `""` selects the whole class. |
| `spin` | `true` opens the wheel and spins it. |
| `replacement` | `false` takes each drawn student out of the pool for the rest of the session. `true` restores normal drawing. Once the teacher flips the wheel's "No repeats" toggle, this option is ignored for the rest of the session. |

### The wheel's pick

`wheelPicked(studentId)` runs in the teacher's frame each time the wheel stops, for scripted spins and the teacher's own spins alike. Look the student up in `context.students`. Write the pick into the teacher's state if students must see it.

### Spotlight

```js
host.spotlight?.(studentId); // show this student's applet to everyone
host.spotlight?.(null);      // end the spotlight
```

- Switches the class to Spotlight, or keeps Anonymous Spotlight if the teacher is already in it.
- The teacher's screen shows the student's applet too, so the projector does.
- An id that is not in the session is ignored.
- Pair it with `wheelPicked` to put the wheel's pick on the projector.

### Timer

```js
host.timer?.(300);                     // countdown everyone sees, in seconds
host.timer?.(300, { shared: false });  // countdown only the teacher sees
host.timer?.(null);                    // cancel
```

- Seconds must be a number above 0 and at most 86,400. Anything else is ignored.
- A new timer replaces the running one.

### Slideshow

The teacher can drive the lesson from the manifest's `slides`. S switches the slideshow on and off. While it is on, the scroll wheel, PageDown, ArrowDown and Space step forward. PageUp and ArrowUp step back. Clickers send PageDown and PageUp, so they work too. One wheel gesture is one step. Students see no difference, because a step only does what the teacher could do by hand.

The teacher can leave the slideshow at any time, act by hand and come back. Coming back resumes at the same step and changes nothing until the next step.

A step does this, in order:

1. Sets the mode the step leaves in force, if any (section 3, `slides`).
2. Calls `slide({ phase, cues })` in the teacher's own live frame.
3. When stepping forward only, runs the step's `wheel` and `timer`.

`phase` is the phase the step leaves in force. When no step so far names one, it is the teacher's current phase.

`cues` is a list of `{ name, fresh }`. It holds every `cue` from the first step of the current phase run up to this step, in step order. A phase run is the unbroken stretch of steps that share the same phase. `fresh` is `true` only on the last cue, and only when the teacher stepped forward onto a step that has a `cue` of its own. Every other cue is a replay with `fresh: false`.

Going back does not undo anything. It re-applies the earlier step, so the applet rebuilds that step from the start of its phase run. The wheel and the timer do not run again.

**Required**

- Implement `slide` if the manifest has `slides` with any `cue` or `phase`. Without it the slideshow still sets modes, the wheel and the timer, but the applet stays where it is.
- In `slide`, move to `phase` first, the same way the applet changes phase on its own, including calling `update`. Then apply each cue in order, and call `update` once the state has changed.
- Make a replay deterministic. A cue with `fresh: false` must skip randomness and one-off effects such as sounds, confetti, timers and wheel spins. The same cues must rebuild the same screen every time.
- Ignore a cue name the applet does not know.

**Recommended**

- Write cues as setters, not steps. "question 2" says where to be. "next question" depends on where the applet already is, and breaks once cues are replayed from the start of the phase. A replay from the start of the phase must rebuild the situation exactly.
- Keep a phase's cues independent of the phases before it. The replay starts at the phase run, not at the first step.
- Do the random part of a cue only when `fresh` is `true`, and keep its result in the state. A replay then reads it back instead of drawing again.
- Use a label-only step where the teacher should act by hand, such as choosing whom to spotlight.
- Pair a `wheel` step with `wheelPicked`, as in Spotlight above, to put the pick on the projector.

## 7. Chatbot and Pulse

Both run on Claude through the teacher's laptop.

### Chatbot instructions

Claude sees only the applet `title`, the `instructions` and the last 40 chat messages. It never sees the state, the phase or the screen.

**Required**

- Write `instructions` assuming Claude cannot see the student's work. Say what the applet asks in each phase, so Claude understands what the student describes.

**Recommended**

- Say what the bot must never do. "Never give the answer outright" is usually the most important line.
- Ask for one guiding question at a time.
- Name the misconceptions you expect.
- Set a length limit, such as "under 80 words".

### Pulse prompt

When the teacher asks for a Pulse, Claude writes a JavaScript function once from the `pulsePrompt`, the `title`, the `phases` and one real input. That code is cached and reused on every later Pulse until the applet file changes. The code returns HTML shown to the teacher.

The input is an object keyed by student id. Each entry is `{ name, phase, state }`. It holds individual student states only. The teacher's state and group states are not included. The same prompt also serves a Pulse for one student, where the input holds one entry.

**Required**

- Write `pulsePrompt` as a specification for code. The sample Claude sees may be cut at 20,000 characters. A field missing from it is invisible to Claude unless the prompt describes it.
- Describe every state field the Pulse should read, with its type and meaning.
- Spell out the phase indexes, such as "0 Predict, 1 Trace".

**Recommended**

- Ask for a fixed order of sections.
- Define "stuck" in countable terms, such as "five or more runs without solving".
- Name the prepared states by their manifest names, so the Pulse can suggest a Reveal.
- Ask for counts, not percentages, and ask for brevity.

## 8. Interface

**Required**

- Never add needless text. If a student can use the applet without a piece of text, cut it.
- Never output an em-dash or a middle dot.
- In meta lines, nav and labels, tell items apart by weight, size, colour or spacing, never by a separator glyph. If two items would get identical treatment, they are one item.
- In prose, write one idea per sentence.
- Use design to communicate. A disabled button, a colour or a position says more than an instruction line.

**Recommended**

- Labels are not needless text. A number, stat or control whose meaning is not obvious at a glance gets a short label.
- Never use the native `title` attribute for tooltips. Build a real tooltip if one is needed.
- Typeset maths with an inlined library such as KaTeX, fonts included. Native MathML relies on the machine's maths font, and a font without stretch data shrinks a long bar to a dash.
- Use the phases as the navigation. One control forward and one back is usually enough.

## 9. Pedagogy

All recommended.

- Order phases by a learning sequence, such as Predict, Run, Investigate, Modify, Make.
- Ask for a commitment before revealing an answer. Lock the prediction once the answer shows.
- Make the student do each step. Reveal the answer after a few wrong tries, and record that it was revealed.
- Give immediate feedback from the student's own attempt, beside what was wanted.
- Close the shortcuts. Re-check work on variant data so hardcoded answers fail.
- Record evidence in the state: attempts, outcomes, misconceptions. The Pulse can report only what the state holds.
- Prepare the states a teacher will want to show, usually a common wrong answer and a model answer.
- Keep one idea per phase.

## 10. Complete example

A yes or no vote. The teacher types a question. Students vote, then explain. The teacher sees live counts, spins the wheel over either answer, and the pick is spotlighted.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <script type="application/json" id="conductor-manifest">
      {
        "title": "Yes or no",
        "phases": ["Vote", "Explain"],
        "instructions": "The teacher asks a yes or no question. In phase 0 the student votes. In phase 1 they explain their vote. You cannot see the question or the vote, so ask for them. Never say which answer is right. Ask one guiding question at a time, under 60 words.",
        "pulsePrompt": "Each state has vote, the string \"yes\" or \"no\" or absent if not voted, and why, the student's explanation as a string. Phases: 0 Vote, 1 Explain. Show the number of yes, no and not voted. Then list by name the students in phase 1 whose why is empty. Be brief.",
        "preparedStates": [
          { "name": "Model answer", "state": { "vote": "yes", "why": "Every example we tried worked." }, "phase": 1 }
        ]
      }
    </script>
    <style>
      body { font: 1.5rem system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; }
      main { display: grid; gap: 1rem; width: min(40rem, 90vw); }
      h1 { margin: 0; font-size: 2.5rem; }
      input, textarea, button { font: inherit; }
      textarea { height: 6rem; }
      .row { display: flex; gap: 1rem; }
      button[aria-pressed="true"] { background: #2563eb; color: white; }
      [hidden] { display: none; }
    </style>
  </head>
  <body>
    <main id="student">
      <h1 id="question"></h1>
      <div class="row">
        <button id="yes" type="button">Yes</button>
        <button id="no" type="button">No</button>
        <button id="next" type="button" aria-label="Next">→</button>
      </div>
      <textarea id="why" aria-label="Why?"></textarea>
      <button id="back" type="button" aria-label="Back">←</button>
    </main>
    <main id="teacher">
      <input id="ask" aria-label="Question" />
      <div class="row">
        <button id="spinYes" type="button">Yes <b id="nYes"></b></button>
        <button id="spinNo" type="button">No <b id="nNo"></b></button>
        <button id="clock" type="button">1:00</button>
      </div>
      <h1 id="picked"></h1>
    </main>
    <script>
      const host = window.conductor ?? { connect() {}, update() {} };
      const DEFAULTS = { question: "", vote: "", why: "" };
      const $ = (id) => document.getElementById(id);
      let state = { ...DEFAULTS };
      let phase = 0;
      let maxPhase = null;
      let ctx = { role: "student", teacher: null, students: null };
      let picked = null;
      let wheelSet = false;

      function voters(vote) {
        return Object.entries(ctx.students ?? {})
          .filter(([, s]) => s.state?.vote === vote)
          .map(([id]) => id);
      }

      function render() {
        const teacher = ctx.role === "teacher";
        $("teacher").hidden = !teacher;
        $("student").hidden = teacher;
        if ($("ask").value !== state.question) $("ask").value = state.question;
        $("nYes").textContent = ctx.students ? voters("yes").length : "";
        $("nNo").textContent = ctx.students ? voters("no").length : "";
        $("picked").textContent = picked ? (ctx.students?.[picked]?.name ?? "") : "";
        $("question").textContent = ctx.teacher?.state?.question ?? "";
        $("yes").setAttribute("aria-pressed", state.vote === "yes");
        $("no").setAttribute("aria-pressed", state.vote === "no");
        $("yes").disabled = $("no").disabled = phase !== 0;
        $("next").hidden = phase !== 0;
        $("next").disabled = !state.vote || (maxPhase !== null && maxPhase < 1);
        $("why").hidden = $("back").hidden = phase !== 1;
        if ($("why").value !== state.why) $("why").value = state.why;
      }

      function change(next, nextPhase = phase) {
        state = { ...state, ...next };
        phase = nextPhase;
        render();
        host.update(state, phase);
      }

      $("yes").onclick = () => change({ vote: "yes" });
      $("no").onclick = () => change({ vote: "no" });
      $("next").onclick = () => change({}, 1);
      $("back").onclick = () => change({}, 0);
      $("why").oninput = (e) => change({ why: e.target.value });
      $("ask").oninput = (e) => change({ question: e.target.value });
      $("spinYes").onclick = () => host.wheel?.({ filter: "Yes", spin: true });
      $("spinNo").onclick = () => host.wheel?.({ filter: "No", spin: true });
      $("clock").onclick = () => host.timer?.(60);

      host.connect({
        setState(s, p) {
          state = { ...DEFAULTS, ...s };
          phase = p;
          render();
        },
        setPhaseLimit(m) {
          maxPhase = m;
          render();
        },
        setContext(c) {
          ctx = c;
          if (ctx.role === "teacher" && ctx.students) {
            if (!wheelSet) {
              wheelSet = true;
              host.wheel?.({ replacement: false });
            }
            host.filters?.([
              { name: "Yes", students: voters("yes") },
              { name: "No", students: voters("no") },
            ]);
          }
          render();
        },
        wheelPicked(id) {
          picked = id;
          render();
          host.spotlight?.(id);
        },
      });
      host.update(state, phase);
      render();
    </script>
  </body>
</html>
```

## 11. Checklist

- One HTML file, every asset inline, no storage APIs.
- The manifest parses: `title` and `phases` present, prepared state phases in range.
- `modes`, if present, has one non-empty list per phase, and each list starts with the mode the phase should open in.
- `instructions` and `pulsePrompt` present, unless the lesson wants no chatbot or no Pulse.
- Fetched resources have a fallback.
- `connect` is called once, before the first `update`.
- `update` follows every change and never follows `setState`.
- The screen renders from the state, phase and context alone.
- `setState` survives a state with missing fields.
- Teacher and students share one state shape.
- The phase never passes the limit.
- The view comes from `context.role`, and the applet renders without a context.
- Filters and tool calls are guarded with `?.` and sent from teacher actions or once on first context.
- `slides`, if present, gives every step a `label`, uses declared phases and modes, and names only prepared states that exist.
- `slide` moves to the phase first, then applies the cues in order, and calls `update` like any other change.
- Cues are setters, so replaying a phase run's cues from its start rebuilds the same screen.
- A cue with `fresh: false` does nothing random and nothing one-off.
- `instructions` assume the bot cannot see the state.
- `pulsePrompt` describes every state field and phase index.
- No needless text, no em-dashes and no middle dots.
