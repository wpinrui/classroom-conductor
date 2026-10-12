# Applet contract

Paste this into the prompt when vibe coding an applet.

An applet is **one HTML file** with every asset inline. It runs in a sandboxed
frame with no network access to the Conductor, so it cannot reach Firebase.

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

`namelist` and `preparedStates` are optional. Phases are referred to by index.

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

See `examples/counter.html` for a complete applet.
`docs/applet-authoring.md` explains every rule and adds pedagogy.
