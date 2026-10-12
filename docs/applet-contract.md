# Applet contract

Paste this into the prompt when vibe coding an applet.

An applet is **one HTML file** with every asset inline. It runs in a sandboxed
frame with an opaque origin, so it cannot reach Firebase.

The frame may load images from any site. It may also `fetch` from any site whose
CORS headers allow every origin (`Access-Control-Allow-Origin: *`), such as
pokeapi.co. The class needs that site to be up, so inline anything the lesson
cannot run without.

## 1. Manifest

Declare the applet in a JSON script tag:

```html
<script type="application/json" id="conductor-manifest">
{
  "title": "Fractions",
  "phases": ["Explore", "Practise", "Reflect"],
  "instructions": "Custom instructions for the student chatbot.",
  "pulsePrompt": "What the teacher wants to learn from the class's states.",
  "namelist": ["Ann Lee", "Bo Tan"],
  "preparedStates": [{ "name": "Worked answer", "state": {}, "phase": 2 }]
}
</script>
```

`instructions`, `pulsePrompt`, `namelist` and `preparedStates` are optional.
Leave out `instructions` to switch the student chatbot off. Leave out
`pulsePrompt` to switch the Pulse off.

Phases are referred to by index. Phase names are shown only to the teacher, in
Paced mode. Students never see them.

## 2. Runtime

The Conductor gives the page a global `conductor` before any applet script runs.

```js
conductor.connect({
  // Replace the whole state and phase. Do not call update in response.
  setState(state, phase) {},
  // Optional. The highest phase allowed, or null for no limit.
  setPhaseLimit(maxPhase) {},
  // Optional. Who this frame belongs to, and what it can see beyond its state.
  setContext({ role, teacher, students }) {},
  // Optional, teacher's frame only. The name wheel landed on this student id.
  wheelPicked(studentId) {},
});

// Call on load and after every change to the state or the phase.
conductor.update(state, phase);

// Optional, from the teacher's frame. Named sets of students for the name wheel.
conductor.filters([{ name: "Said yes", students: ["uid1", "uid2"] }]);
```

`setContext` arrives before the first `setState` and again whenever it changes.

- `role` is `"teacher"` when the frame shows the teacher's state and `"student"` otherwise. Render the teacher's view from it.
- `teacher` is `{ state, phase }`, the teacher's live state, in student frames. It is `null` in teacher frames. Use it to follow what the teacher sets up, such as the current question.
- `students` maps each student id to `{ name, phase, state, online }`, in the teacher's own frame only. It is `null` everywhere else, including Demo.

`filters` replaces every filter the name wheel offers. The wheel always offers the whole class, so publish only the sets a predicate picks out.

Rules:

- The state is plain JSON and is the **whole** truth: rendering it from scratch
  must reproduce the screen exactly. Keep UI-only details (hover, scroll) out.
- Phase is an index into `phases`. Changing page means calling `update` with the
  new phase.
- Never move past the phase limit. The Conductor also pushes the last allowed
  state back if the applet tries.
- Ctrl+. and Cmd+. are reserved for the teacher's controls.

## 3. Class tools

An applet can script the class tools. Only the teacher's own applet is heard.
The same calls from a student's applet do nothing. The teacher can open,
change or close any tool from the controls at any time, so the teacher always
wins.

```js
// Countdown everyone sees, here five minutes.
conductor.timer(300);
// Countdown only the teacher sees.
conductor.timer(300, { shared: false });
// Cancel the countdown.
conductor.timer(null);
```

A new timer replaces the running one.

### Spotlight

```js
// Spotlight a student, by id. Everyone's screen and the teacher's show theirs.
conductor.spotlight(studentId);
// End the spotlight.
conductor.spotlight(null);
```

Spotlight switches the class into Spotlight mode, or keeps Anonymous Spotlight
if the teacher is already in it. Pair it with `wheelPicked` to put the wheel's
pick on the projector. The teacher can also do that with one tap on the wheel.

### Name wheel

```js
conductor.wheel({ filter: "Said yes", spin: true });
conductor.wheel({ replacement: false });
```

Every option is optional and changes only what it names.

| Option | Effect |
| --- | --- |
| `open` | `true` opens the wheel and `false` closes it. |
| `filter` | Selects a filter by name. `""` selects the whole class. |
| `spin` | `true` opens the wheel and spins it. |
| `replacement` | `false` takes each drawn student out of the pool for the rest of the session. `true` puts drawing back to normal. The teacher's "No repeats" toggle sets the same value, and once the teacher uses it the applet's value is ignored for the rest of the session. |

See `examples/counter.html` for a complete applet.
`docs/applet-authoring.md` explains every rule and adds pedagogy.
