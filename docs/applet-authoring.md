# Applet authoring guide

This guide is for agents that write applets for Classroom Conductor.
`docs/applet-contract.md` is the short version to paste into a prompt.
This guide adds the reasons, the traps and the pedagogy.

Every rule is marked as one of two kinds.

- **Required** rules are enforced by the code. Break one and the upload fails, the state is lost, or the teacher's controls stop working.
- **Recommended** rules make an applet good to teach with. The Conductor still runs an applet that ignores them.

Read `examples/number-line.html` first. It is the smallest applet that does everything right.
`applets/python-for-loops.html` is a full lesson built the same way.
`applets/mango-or-pear.html` shows the context, the name wheel filters and a scripted wheel.

## 1. The file

**Required**

- The applet is one HTML file. Every script, style, image and font is inline.
- It runs in an iframe with `sandbox="allow-scripts allow-forms allow-modals"` (`src/applet/AppletFrame.tsx`). The origin is opaque. `localStorage`, `sessionStorage`, cookies and IndexedDB throw or fail. Popups, downloads and navigating the top page are blocked.
- Outside network requests work within that origin. Images load from any site. `fetch` reaches any site that answers with `Access-Control-Allow-Origin: *`, because the frame's origin is `null`. A site that lists allowed origins rejects it.
- Keep anything that must persist in the state (section 3). Nothing else survives a reload.
- Inline what the lesson cannot run without. A fetched site can be down or blocked by the school network. Show a usable screen while a fetch is pending or after it fails.

**Recommended**

- Design for a 1280 pixel wide viewport. Teacher thumbnails render the applet at 1280 pixels and scale it down (`src/teacher/Thumbnails.tsx`).
- Keep the screen readable from the back of a room. The teacher projects it in Demo, Spotlight and Reveal.

## 2. The manifest

Declare the manifest in a JSON script tag:

```html
<script type="application/json" id="conductor-manifest">
{
  "title": "Where is 3/8?",
  "phases": ["Place", "Explain"],
  "instructions": "Help the student place 3/8 ...",
  "pulsePrompt": "Each state has x and note ...",
  "namelist": ["Ann Lee", "Bo Tan"],
  "preparedStates": [{ "name": "Read as digits", "state": { "x": 0.38, "note": "" }, "phase": 1 }]
}
</script>
```

**Required.** `parseManifest` in `src/applet/manifest.ts` rejects the upload if any of these fail.

| Field | Rule |
| --- | --- |
| tag | A `<script>` whose `id` is `conductor-manifest` in quotes. The first `</script>` after it ends the manifest. |
| body | Valid JSON, and an object. Write `<\/script>` if a string must contain that text. |
| `title` | A non-empty string. It names the applet in the library and in prompts. |
| `phases` | A non-empty list of strings. Phases are referred to by index everywhere else. |
| `instructions` | Optional. A string. |
| `pulsePrompt` | Optional. A string. |
| `namelist` | Optional. A list of strings. |
| `preparedStates` | Optional. A list of `{ name, state, phase }`. `name` is a string. `state` is present. `phase` is an integer index into `phases`. |

**What each field does**

- `namelist` locks the session to those names. A student must type one of them to join. Matching ignores case and repeated spaces (`nameKey` in `src/applet/manifest.ts`). Leave it out to let any name join.
- `preparedStates` become buttons in the teacher's Reveal picker. Each `name` is the button label. Keep names short and unique, because two equal names share one button key.
- `instructions` and `pulsePrompt` go to Claude. Section 6 covers how to write them.
- Leaving out `instructions` switches the chatbot off for students and the teacher. Leaving out `pulsePrompt` removes every Pulse button. An empty string keeps the feature on with no guidance, so leave the field out instead.
- Phase names appear only on the teacher's Paced stepper. Students never see them, so a name may give away what a phase is for.

## 3. The runtime

The Conductor injects a script before any of yours. It defines `window.conductor` with two functions.

```js
const host = window.conductor ?? { connect() {}, update() {} };

host.connect({
  // Replace the whole state and phase, then render.
  setState(s, p) { state = normalize(s); phase = p; render(); },
  // Optional. The highest phase allowed, or null for no limit.
  setPhaseLimit(m) { maxPhase = m; render(); },
});

// Once on load, after connect.
host.update(state, phase);
```

**Required**

- Call `connect` before your first `update`. The host replays a saved state when it hears `connect`. An `update` sent before that would be saved over the student's real work.
- Call `update(state, phase)` on load and after every change to the state or the phase. A student has no saved state until the first `update` arrives.
- Never call `update` from inside `setState`. The host pushed that state, so it already knows it.
- The state is plain JSON. It is copied with `JSON.parse(JSON.stringify(...))`, so functions, `undefined`, `Map`, `Set` and class instances are lost, and `NaN` becomes `null`.
- The state is the **whole** truth. Rendering it from scratch must reproduce the screen exactly. Students watch each other's applets in Spotlight, Gallery and the teacher's thumbnails. Those frames receive only the state and the phase.
- Keep UI-only details out of the state. Hover, scroll, focus and open menus never belong in it.
- The phase travels beside the state. It is an index into `phases` and is coerced to an integer. Do not also store it inside the state.
- Changing page means calling `update` with the new phase.
- Never move past the phase limit. In Paced mode the host sends the limit through `setPhaseLimit`. If the applet sends a higher phase anyway, the host pushes the last allowed state back.
- `setState` can arrive at any time. In Group mode several students edit one shared state, so another member's change lands while this student is typing. Do not reset a text field's value when it already matches the state, or the caret jumps.
- Ctrl+. and Cmd+. are taken by the Conductor before your handlers see them. Do not bind them.
- Accept states that are missing fields. Prepared states live inside the manifest, which is stored in Realtime Database. That database drops `null` values and empty arrays. It also turns objects with numeric keys into arrays with `null` holes. A prepared state can therefore reach `setState` with fields gone. Merge every incoming state over your defaults. `normalize()` in `applets/python-for-loops.html` shows how.

**Recommended**

- Keep the fallback `window.conductor ?? { connect() {}, update() {} }`. The file then opens on its own in a browser for testing.
- Keep the state small. The database rejects a state of 2,000,000 characters or more. Each `update` is written to the database, so a lean state also keeps the class in sync.
- Treat a missing field as its empty value instead of trusting `null`. `examples/number-line.html` reads a missing `x` as unplaced.
- Disable the next phase control when the phase limit forbids it, so a student never presses a button that silently fails.

**Class tools**

The applet can drive the class tools listed in `docs/applet-contract.md`. A typical use is a timer that starts when the teacher reaches a phase.

```js
if (phase === 2) host.timer?.(300); // five minutes for the Make task
```

- Only calls from the teacher's applet take effect. Students run the same file, so the same line is harmless there.
- Guard each call with `?.`. The fallback host has no tools, so the file still opens on its own.
- The teacher can override any scripted tool. Script a sensible default, never a hard requirement.
- Call a tool on a change you made, not inside `setState`. The teacher's applet replays its state on reload, and calling from `setState` would restart the timer.

## 4. Context and the name wheel

An applet cannot read the database, so the host hands it what it needs to see beyond its own state.

```js
host.connect({
  setState(s, p) { /* ... */ },
  setContext(c) { context = c; render(); },
});
```

**Required**

- Treat `setContext` as optional. It arrives before the first `setState`, but an applet opened on its own never gets one. Default to `{ role: "student", teacher: null, students: null }`.
- Pick the view from `context.role`, never from who is looking. Demo shows the teacher's state on a student's device with role `"teacher"`. Thumbnails and Spotlight show a student's state on the teacher's device with role `"student"`.
- Render from the state and the context together. A frame showing another student's state gets the same `teacher` context, so it can draw the same question.
- Expect `context.students` to be `null` in every frame except the teacher's own live one. Anything drawn from it must also work without it. Copy a summary into the teacher's state when students must see it, such as revealed counts.
- Calling `update` from `setContext` is allowed, because the host did not push that state. Only call it when the state really changed.
- Send `conductor.filters(list)` from the teacher's frame only, with `role === "teacher"` and `students` present. Each entry is `{ name, students }`, where `students` lists student ids. Each call replaces every earlier filter. Guard the call with `if (host.filters)` when using the fallback host.

**Recommended**

- Publish filters the teacher would call on, such as "True" and "False" for the current question. The wheel always offers the whole class, so never publish an everyone filter.
- Keep filter names short and unique. They become buttons beside the wheel.
- Publish nothing that would leak a hidden result. The wheel shows how many students each filter holds. `applets/mango-or-pear.html` publishes its True and False filters only after the teacher reveals the counts.
- Keep per question data keyed by a stable id that the teacher's state assigns. A student's answer then stays attached to its question when the teacher moves on.

### The wheel's pick

`wheelPicked(studentId)` in `connect` runs in the teacher's frame each time the wheel stops. It runs for scripted spins and the teacher's own spins alike.

```js
host.connect({
  // ...
  wheelPicked(id) { called = id; render(); },
});
```

- Look the student up in `context.students`.
- Write the pick into the teacher's state if students must see it.
- To show the student's screen, call `host.spotlight?.(id)`. The teacher can also spotlight the pick with one tap on the wheel. Either way the teacher's screen shows the student's, so the projector does too. Switching mode ends it.

### Scripting the wheel

`conductor.wheel(options)` drives the name wheel from the teacher's frame. `docs/applet-contract.md` lists the options.

**Required**

- Send only what you mean to change. Every option is optional, and a missing one leaves the wheel as it is.
- Call on a teacher action or once on load. Never call on every class update, because the teacher's own changes would keep being undone.
- Treat every call as a suggestion. The teacher can close the wheel, change its pool or flip No repeats at any time. Once the teacher flips No repeats, `replacement` from the applet is ignored for the rest of the session.

**Recommended**

- Put the call on the thing it acts on. The mango or pear applet puts a wheel button on each revealed bar, which spins over the students who gave that answer.
- Set session settings once, when the teacher's frame first gets its context. The mango or pear applet turns replacement off there, so each student is called on at most once a lesson.

## 5. The interface

**Required**

- Never add needless text to the applet. If a student can use the applet without a piece of text, cut it.
- Never output an em-dash or a middle dot. They stand in for decisions.
- In meta lines, nav and labels, tell items apart by weight, size, colour or spacing, never by a separator glyph. If two items would get identical treatment, they are one item, so merge or cut them.
- In prose, write one idea per sentence. A clause that matters gets its own sentence or a conjunction naming the relationship. A clause that doesn't gets deleted.
- Use design to communicate, not lazy text. A disabled button, a colour or a position says more than an instruction line.

**Recommended**

- Labels are not needless text. Any number, stat or control whose meaning is not obvious at a glance gets a short label.
- Never use the native `title` attribute for tooltips. Build a real tooltip if one is needed.
- Respect the student's phase list as the navigation. One control to move forward and one to move back is usually enough.

## 6. The chatbot and the Pulse

### Chat

The Engine builds the chat prompt in `engine/src/chat.ts`. Claude sees the applet `title`, your `instructions` and the last 40 chat messages. Nothing else reaches it.

**Required**

- Write `instructions` assuming Claude **cannot** see the student's state, phase or screen. Tell it what the applet asks students to do in each phase, so it can understand what a student describes.

**Recommended**

- Say what the bot must never do. "Never give the answer outright" is the most important line in most lessons.
- Ask for one guiding question at a time.
- Name the misconceptions you expect, so the bot can name them back.
- Set a length limit, such as "under 80 words".

### Pulse

The Engine builds the Pulse prompt in `engine/src/pulse.ts`. Claude sees your `pulsePrompt`, the `title`, the `phases` and one real input. It writes JavaScript once, and the Engine caches that code by the applet's HTML. Every later Pulse runs the cached code on new input. If the code throws, Claude rewrites it once with the error. Editing the applet file throws the cache away.

The input is an object keyed by student id. Each entry is `{ name, phase, state }`. It holds individual student states only. Group states are not included.

**Required**

- Write `pulsePrompt` as a specification for code. The code is written from one sample that may be truncated at 20,000 characters. Fields absent from that sample are invisible to Claude unless your prompt describes them.
- Describe every state field the Pulse should read, with its type and meaning.
- Spell out the phase indexes, such as "0 Predict, 1 Trace".

**Recommended**

- Ask for a fixed order of sections, so every Pulse reads the same way.
- Define "stuck" in countable terms, such as "five or more runs without solving".
- Name the prepared states by their manifest names, so the Pulse can suggest a Reveal.
- Ask for counts, not percentages, and ask for brevity.
- Cover the single student case too. The same prompt serves a Pulse for one student.

## 7. Pedagogy

These are all **recommended**. They come from the for loops lesson, which shows each of them in working code.

- **Order phases by a learning sequence.** The for loops lesson follows PRIMM: Predict, Run, Investigate, Modify, Make. A phase list is a lesson plan the teacher can pace.
- **Commit before reveal.** Ask for a prediction before showing the answer. Lock the prediction once the answer shows, which keeps the record honest.
- **Make the student do the step.** In Trace, the student types the next value before the applet reveals it. Reveal the answer after three wrong tries, and record that it was revealed.
- **Give immediate feedback from the student's own attempt.** Show what their input produced beside what was wanted. Mark each line right or wrong.
- **Close the shortcuts.** The for loops lesson switches off `sum()` so students write the loop. Modify and Make tasks re-run on variant data, so hardcoded output fails.
- **Record evidence, not just results.** Store attempts, run counts, outcomes and detected misconception tags. The Pulse can only report what the state records.
- **Prepare the states a teacher will want to show.** A common wrong answer and a model answer are the usual pair. `examples/number-line.html` prepares "Read as digits" next to the correct placement.
- **Keep one idea per phase.** A phase that needs a paragraph to explain is two phases.

## 8. Checklist

Before handing over an applet, check every required item:

- One HTML file, every asset inline, no storage APIs.
- The manifest parses: `title` and `phases` present, prepared state phases in range.
- `instructions` and `pulsePrompt` present, unless the lesson wants no chatbot or no Pulse.
- Fetched resources have a fallback, and lesson critical assets are inline.
- `connect` is called before the first `update`.
- `update` follows every change, and never follows `setState`.
- The screen renders from the state and phase alone.
- `setState` survives a state with missing fields.
- The phase never passes the limit.
- `instructions` assume the bot cannot see the state.
- `pulsePrompt` describes every state field and phase index.
- The screen renders without a context, and filters and tool calls go out from the teacher's frame only.
- No needless text, no em-dashes and no middle dots.
