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
});

// Call on load and after every change to the state or the phase.
conductor.update(state, phase);
```

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
